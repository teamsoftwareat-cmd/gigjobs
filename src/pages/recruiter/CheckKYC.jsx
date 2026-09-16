import { useMemo, useState, useRef, useContext, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSearch, faUpload, faCheckCircle, faTimes, faSpinner, faFileCsv, faDownload, faFilter, faHistory, faFileArchive, faEye } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, DataTable, LoadingOverlay, Tag, Tabs, StatCard, Modal } from '../../components/ui/index'
import { recruiterAPI } from '../../api/axios'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import * as XLSX from 'xlsx-js-style'
import CandidateInfo from './CandidateInfo'
import ReactDOM from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { BIHAR_POLICE_STATIONS } from '../../components/Registration/Step2Profile'
import heic2any from 'heic2any'

const getStatusLabel = (item) => {
  const raw = item.status || item.kyc_status || item.verification_status || item.aadhaarVerificationStatus || item.kyc || item.verification
  if (!raw) return 'Pending'
  return String(raw).trim() || 'Pending'
}

const getStatusVariant = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('verified') || normalized.includes('valid')) return 'green'
  if (normalized.includes('not_registered') || normalized === 'not registered') return 'gray'
  if (normalized.includes('pending') || normalized.includes('yet') || normalized.includes('not verified')) return 'yellow'
  if (normalized.includes('invalid') || normalized.includes('rejected') || normalized.includes('failed') || normalized.includes('unverified')) return 'red'
  return 'gray'
}

const getStatusCategory = (status) => {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('not_registered') || normalized === 'not registered') return 'not_registered'
  if (normalized.includes('not verified') || normalized.includes('not_verified') || normalized.includes('unverified') || normalized.includes('invalid') || normalized.includes('rejected') || normalized.includes('failed')) return 'not_verified'
  if (normalized.includes('verified') || normalized.includes('valid')) return 'verified'
  if (normalized.includes('pending') || normalized.includes('yet')) return 'not_verified'
  if (normalized.includes('not')) return 'not_verified'
  return 'not_registered'
}

const isSupportedSheetFile = (file) => /\.(csv|xls|xlsx)$/i.test(file?.name || '')

const normalizeSheetHeader = (header) => String(header || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')

const normalizeSheetRow = (row, rowNumber) => {
  const raw = { ...row }
  const normalized = Object.entries(row).reduce((acc, [key, value]) => {
    acc[normalizeSheetHeader(key)] = value
    return acc
  }, {})

  return {
    rowNumber,
    raw,
    data: {
      district: normalized.district || '',
      centre_code: normalized.centre_code || normalized.center_code || '',
      centre: normalized.centre || normalized.center || '',
      name: normalized.name || normalized.candidate_name || '',
      mobile: normalized.mobileno || normalized.mobile || normalized.mobile_number || '',
      aadhaar: normalized.aadharno || normalized.aadhaar || normalized.aadhaar_number || '',
      designation: normalized.designation || '',
      location: normalized.location || '',
    },
  }
}

const getCandidateSheetKey = (candidate = {}) => {
  const value = candidate.id || candidate.candidate_id || candidate.candidateId || candidate.s_no
  return value === undefined || value === null ? '' : String(value).trim()
}

const findUploadedSheetRow = (candidate, sheetRows, index) => {
  const candidateId = getCandidateSheetKey(candidate)
  const candidateMobile = String(candidate.mobile || candidate.mobileno || candidate.mobile_number || '').replace(/\D/g, '')
  const candidateAadhaar = String(candidate.aadhaar || candidate.aadhar || candidate.aadhar_number || candidate.aadhaar_number || '').replace(/\D/g, '')

  return sheetRows.find((sheetRow) => {
    const data = sheetRow.data
    const rowId = getCandidateSheetKey(data)
    const rowMobile = String(data.mobile || '').replace(/\D/g, '')
    const rowAadhaar = String(data.aadhaar || '').replace(/\D/g, '')
    return (candidateId && rowId && candidateId === rowId) ||
      (candidateMobile && rowMobile && candidateMobile === rowMobile) ||
      (candidateAadhaar && rowAadhaar && candidateAadhaar === rowAadhaar)
  }) || sheetRows[index]
}

const mapResultRow = (row, index, uploadedData = {}) => {
  const source = row || {}

  return {
    id: source.id || source.s_no || index + 1,
    candidateId: source.id || source.candidate_id || source.candidateId || source.s_no || index + 1,
    name: source.name || source.candidatename || source.candidate_name || source['Candidate Name'] || source['name'] || 'Unknown',
    mobile: source.mobile || source.mobileno || source.mobile_number || source.candidate_mobile_number || source['MobileNo'] || source['mobile'] || '',
    aadhaar: source.aadhaar || source.aadhar || source.aadhar_number || source['AadharNo'] || source['aadhaar'] || '',
    location: source.location || source.location_name || '',
    status: getStatusLabel(source),
    // Store additional detail fields for dynamic column support
    district: source.district || source.district_name || '',
    centre: source.centre || source.center || source.centre_name || '',
    centreCode: source.centre_code || source.centerid || source.centre_id || source.centerId || '',
    designation: source.designation || source.Designation || source.designation_name || source['Designation'] || '',
    uploadedData,
  }
}

const getColumnsFromData = (data, rawApiData = [], includeCheckbox = false) => {
  // Determine which location columns to show based on what's in the data
  const columns = includeCheckbox ? ['Select'] : []
  columns.push('S.No', 'Name', 'Mobile', 'Aadhaar')
  
  // Check if we should show location column or district/centre columns
  const hasLocation = rawApiData && rawApiData.some(item => {
    const location = item.location || item.location_name
    return location && String(location).trim().length > 0
  })
  
  const hasDistrictCentre = rawApiData && rawApiData.some(item => {
    const district = item.district || item.district_name
    const centre = item.centre || item.center || item.centre_name
    const centreCode = item.centre_code || item.centerid || item.centre_id || item.centerId
    return (district && String(district).trim().length > 0) || (centre && String(centre).trim().length > 0) || (centreCode && String(centreCode).trim().length > 0)
  })
  
  // Prefer location if available, otherwise show district/centre/centre code
  if (hasLocation) {
    columns.push('Location')
  } else if (hasDistrictCentre) {
    const hasCentreId = rawApiData && rawApiData.some(item => item.centre_code || item.centerid || item.centre_id || item.centerId)
    columns.push('District', 'Centre')
    if (hasCentreId) {
      columns.push('Centre Code')
    }
  }
  
  // Check if Designation data exists
  const hasDesignation = rawApiData && rawApiData.some(item => {
    const designation = item.designation || item.Designation || item.designation_name
    return designation && String(designation).trim().length > 0
  })
  
  if (hasDesignation) {
    columns.push('Designation')
  }
  
  columns.push('Status', 'Action')
  return columns
}

const buildTableRows = (filteredResults, columns, selectedCandidates, onSelectionChange, onViewCandidate) => {
  return filteredResults.map((item, index) => {
    const row = []
    columns.forEach((col) => {
      switch (col) {
        case 'Select':
          row.push(
            <input
              key={`${item.id}-checkbox`}
              type="checkbox"
              checked={selectedCandidates.has(String(item.id))}
              onChange={(e) => {
                const newSelected = new Set(selectedCandidates)
                if (e.target.checked) {
                  newSelected.add(String(item.id))
                } else {
                  newSelected.delete(String(item.id))
                }
                onSelectionChange(newSelected)
              }}
              style={{ cursor: 'pointer' }}
            />
          )
          break
        case 'S.No':
          row.push(index + 1)
          break
        case 'Name':
          row.push(item.name)
          break
        case 'Mobile':
          row.push(item.mobile || '—')
          break
        case 'Aadhaar':
          row.push(item.aadhaar || '—')
          break
        case 'Location':
          row.push(item.location || '—')
          break
        case 'District':
          row.push(item.district || '—')
          break
        case 'Centre':
          row.push(item.centre || '—')
          break
        case 'Centre Code':
          row.push(item.centreCode || item.centerid || '—')
          break
        case 'Designation':
          row.push(item.designation || '—')
          break
        case 'Status':
          row.push(
            <Tag key={`${item.id}-status`} variant={getStatusVariant(item.status)}>
              {item.status}
            </Tag>
          )
          break
        case 'Action':
          row.push(
            <button
              key={`${item.id}-view`}
              className="btn btn-tertiary btn-sm"
              onClick={() => onViewCandidate(item.candidateId)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FontAwesomeIcon icon={faEye} size="sm" /> View
            </button>
          )
          break
        default:
          row.push('')
      }
    })
    return row
  })
}

// Helper function to process items with concurrency limit
const processConcurrently = async (items, processor, concurrencyLimit = 5, onCancel) => {
  const results = []
  const inProgress = new Set()
  let cancelled = false

  const checkCancellation = () => {
    if (onCancel?.isCancelled) {
      cancelled = true
      throw new Error('Export cancelled by user')
    }
  }

  for (let i = 0; i < items.length; i++) {
    checkCancellation()

    // Wait if we have reached the concurrency limit
    while (inProgress.size >= concurrencyLimit) {
      await Promise.race(inProgress)
      checkCancellation()
    }

    // Start a new task
    const promise = processor(items[i], i)
      .then((result) => {
        results[i] = result
        inProgress.delete(promise)
      })
      .catch((err) => {
        results[i] = null
        inProgress.delete(promise)
      })

    inProgress.add(promise)
  }

  // Wait for all remaining tasks
  while (inProgress.size > 0) {
    checkCancellation()
    await Promise.race(inProgress)
  }

  return results
}

// Tunable performance constants
const PDF_CONCURRENCY = 4
const IMAGE_CONCURRENCY = 12
// reduce html2canvas scale to lower image sizes for faster generation
const HTML2CANVAS_SCALE = 1.4
// switch to JPEG for smaller image output
const PDF_IMAGE_FORMAT = 'JPEG'

// HEIC conversion helpers (mirrors CandidateInfo.jsx)
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const HEIC_URL_PATTERN = /(?:\.heic|\.heif)(?:[?#]|$)/i

const getDisplayableImageUrl = async (url) => {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error('Image fetch failed:', response.status, response.statusText, url)
      return null
    }

    const blob = await response.blob()
    const contentType = response.headers.get('content-type') || blob.type
    const isHeic = /heic|heif/i.test(contentType) || HEIC_URL_PATTERN.test(url)
    if (isHeic) {
      try {
        let convertedBlob = await heic2any({ blob, toType: 'image/jpeg', quality: 0.85 })
        if (Array.isArray(convertedBlob) && convertedBlob.length) convertedBlob = convertedBlob[0]
        return await blobToDataUrl(convertedBlob)
      } catch (convertError) {
        console.error('HEIC conversion failed:', convertError, url)
        // fallback: try to return the fetched blob as a data URL so html2canvas can include it
        try {
          return await blobToDataUrl(blob)
        } catch (e) {
          return null
        }
      }
    }
    // For non-HEIC images, return a data URL to avoid CORS issues when rendering to canvas
    try {
      return await blobToDataUrl(blob)
    } catch (e) {
      console.error('Failed to convert image blob to data URL:', e, url)
      return url
    }
  } catch (error) {
    console.error('Error converting image:', error, url)
    return url
  }
}

// Helper function to generate safe folder/file names
const sanitizeFileName = (str) => {
  if (!str) return 'Unknown'
  return String(str)
    .trim()
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}

const formatPdfDate = (value) => {
  if (!value) return ''
  const raw = String(value).trim()
  const parseDate = (input) => {
    const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/) // yyyy-mm-dd
    if (isoMatch) return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`)
    const dmyMatch = input.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/) // dd-mm-yyyy or dd/mm/yyyy
    if (dmyMatch) return new Date(`${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}T00:00:00`)
    const date = new Date(input)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = parseDate(raw)
  if (!date) return raw
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  return `${dd}-${mm}-${yyyy}`
}

const formatPersonName = (value) => {
  if (!value) return ''
  const name = String(value).trim()
  if (!name || /^_+$/.test(name)) return name
  return name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, separator, letter) => `${separator}${letter.toUpperCase()}`)
}

// Helper function to get formatted file name
const getFormattedFileName = (candidate) => {
  const name = sanitizeFileName(candidate.name)
  const mobile = sanitizeFileName(candidate.mobile)
  const aadhaar = sanitizeFileName(candidate.aadhaar)
  return `${name}_${mobile}_${aadhaar}.pdf`
}

// Fetch helper with retries and cancellation support
const fetchWithRetries = async (url, options = {}, retries = 2, onCancel) => {
  if (!url) return null
  let attempt = 0
  const delay = (ms) => new Promise((res) => setTimeout(res, ms))
  while (attempt <= retries) {
    if (onCancel?.isCancelled) throw new Error('Export cancelled')
    try {
      const res = await fetch(url, { ...options, cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.blob()
    } catch (err) {
      attempt++
      if (attempt > retries) return null
      // backoff
      // eslint-disable-next-line no-await-in-loop
      await delay(500 * attempt)
    }
  }
  return null
}

const getImageUrlsFromCandidate = (raw, mode) => {
  const urls = {}
  if (mode === 'all_images' || mode === 'profile') {
    urls.profile = raw?.profileImage || raw?.profile_image || raw?.candidate_image || raw?.photo || raw?.image
  }
  if (mode === 'all_images' || mode === 'aadhaar_front') {
    urls.aadhaar_front = raw?.aadhaarFront || raw?.aadhaar_front || raw?.aadhaar_front_image || raw?.aadhaar_front_url
  }
  if (mode === 'all_images' || mode === 'aadhaar_back') {
    urls.aadhaar_back = raw?.aadhaarBack || raw?.aadhaar_back || raw?.aadhaar_back_image || raw?.aadhaar_back_url
  }
  return urls
}

const createProfileImageExcelRows = (selectedRows = [], rawApiData = [], profileImageExportItems = []) => {
  if (profileImageExportItems && profileImageExportItems.length > 0) {
    return profileImageExportItems.map((item) => ({
      Name: item.row?.name || '',
      'Mobile Number': item.row?.mobile || '',
      'Aadhaar Number': item.row?.aadhaar || '',
      'File Name': item.fileName || ''
    }))
  }

  const rows = []
  selectedRows.forEach((row) => {
    const candidateId = row?.candidateId
    const rawCandidate = rawApiData.find((item) => String(item.id || item.candidate_id || item.candidateId) === String(candidateId))
    const imageUrls = getImageUrlsFromCandidate(rawCandidate, 'profile')
    const imageUrl = imageUrls.profile

    if (!imageUrl) return

    let ext = 'jpg'
    try {
      const url = new URL(imageUrl)
      const parsedExt = url.pathname.split('.').pop()?.split(/[#?]/)[0]
      if (parsedExt) ext = parsedExt
    } catch (err) {
      // ignore and use default
    }

    const baseName = `${sanitizeFileName(row.name || '')}_${sanitizeFileName(row.mobile || '')}_${sanitizeFileName(row.aadhaar || '')}`
    rows.push({
      Name: row.name || '',
      'Mobile Number': row.mobile || '',
      'Aadhaar Number': row.aadhaar || '',
      'File Name': `${baseName}.${ext}`
    })
  })

  return rows
}

const generateCandidatePDF = async (candidateId) => {
  try {
    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.padding = '0px'
    tempContainer.style.borderRadius = '0px'
    tempContainer.innerHTML = '<div id="candidate-export-container"></div>'
    document.body.appendChild(tempContainer)

    const exportContainer = tempContainer.querySelector('#candidate-export-container')
    const root = ReactDOM.createRoot(exportContainer)
    root.render(
      <MemoryRouter>
        <CandidateInfo candidateId={candidateId} suppressApiMessages={true} />
      </MemoryRouter>
    )

    const waitTimeout = 30000
    const pollInterval = 200
    let waited = 0
    let exportRoot = exportContainer.querySelector('[data-export-root]')
    const loadingRegex = /Loading candidate details|Loading verification data|Loading verification/i
    while ((!exportRoot || loadingRegex.test(exportRoot.innerText)) && waited < waitTimeout) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, pollInterval))
      waited += pollInterval
      exportRoot = exportContainer.querySelector('[data-export-root]')
    }

    if (!exportRoot) {
      try { root.unmount() } catch (e) {}
      document.body.removeChild(tempContainer)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Skipped candidate ${candidateId} - failed to load details`, duration: 2000 }
      }))
      return { error: 'failed_to_load_details' }
    }

    const headerEl = exportRoot.querySelector('[data-export-header]')
    if (headerEl) headerEl.style.display = 'none'

    // Ensure images are loaded (and converted to data URLs by CandidateInfo) before capturing
    const images = exportRoot.querySelectorAll('img')
    await Promise.all(Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    }))

    const canvas = await html2canvas(exportRoot, {
      scale: HTML2CANVAS_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: exportRoot.scrollWidth,
      height: exportRoot.scrollHeight,
      windowWidth: exportRoot.scrollWidth,
      windowHeight: exportRoot.scrollHeight
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const imgData = canvas.toDataURL('image/jpeg', 0.8)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    let imgWidth = pdfWidth
    let imgHeight = (imgProps.height * pdfWidth) / imgProps.width
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight
      imgWidth = (imgProps.width * pdfHeight) / imgProps.height
    }
    let heightLeft = imgHeight
    pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, 0, imgWidth, imgHeight)
    heightLeft -= pdfHeight
    while (heightLeft > 0) {
      const position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    try { root.unmount() } catch (e) {}
    document.body.removeChild(tempContainer)
    const pdfBlob = pdf.output('blob')
    return { blob: pdfBlob }
  } catch (err) {
    console.error('generateCandidatePDF error:', err)
    return { error: err?.message || 'generate_error' }
  }
}

const normalizePoliceCandidateResponse = (response) => {
  const payload = response?.data?.data || response?.data || response
  if (!payload) return null
  return {
    id: payload.id || payload.candidateId || payload.candidate_id || payload.login_id || '',
    name: payload.name || payload.candidate_name || payload.candidatename || 'Unknown',
    mobile: payload.mobile || payload.mobileno || payload.mobile_number || payload.candidate_mobile_number || '',
    whatsapp: payload.whatsapp || payload.whatsapp_number || payload.whatsappNumber || '',
    email: payload.email || payload.email_address || payload.emailId || '',
    profileImage: payload.profileImage || payload.profile_image || payload.photo || payload.image || null,
    location: payload.location || payload.currentLocation || payload.location_name || '',
    gender: payload.gender || payload.sex || '',
    dob: payload.dob || payload.date_of_birth || payload.dateOfBirth || '',
    fatherName: payload.father_name || payload.fatherName || payload.care_of || '',
    presentAddress: payload.presentAddress || payload.current_address || payload.currentAddress || payload.address || '',
    permanentAddress: payload.permanentAddress || payload.permanent_address || '',
    aadhaarNumber: payload.aadhaarNumber || payload.aadhar || payload.aadhar_number || payload.masked_aadhaar || '',
    panNumber: payload.panNumber || payload.pan || payload.pan_no || payload.pan_number || payload.PAN || payload.PAN_NO || payload.PAN_NUMBER || '',
    aadhaarFront: payload.aadhaarFront || payload.aadhaar_front || payload.aadharFront || payload.aadhaar_front_url || null,
    aadhaarBack: payload.aadhaarBack || payload.aadhaar_back || payload.aadharBack || payload.aadhaar_back_url || null,
    education: payload.education || payload.highestEducation || '',
    degree: payload.degree || payload.qualification || '',
    college: payload.college || payload.institution || '',
    completionYear: payload.completionYear || payload.passing_year || payload.year_of_completion || '',
    pincode: payload.pincode || payload.pin || payload.postalCode || payload.postal_code || '',
    district: payload.district || payload.district_name || payload.districtName || '',
    centre: payload.centre || payload.center || payload.centre_name || payload.center_name || '',
    centreCode: payload.centre_code || payload.centerid || payload.centre_id || payload.centerId || payload.centreCode || '',
    // Map nearest police station fields so template can include them in exports
    nearestPoliceStation: payload.nearestPoliceStation || payload.nearest_police_station || payload.police_station || '',
    nearestPolicePin: payload.nearestPoliceStationPincode || payload.nearest_police_station_pin_code || payload.nearest_police_station_pin || payload.police_station_pin || '',
    currentStatus: payload.currentStatus || payload.current_status || payload.status || '',
  }
}

// Helper to normalize/expand gender values for display
const formatGender = (g) => {
  if (g === null || g === undefined || String(g).trim() === '') return '—'
  const s = String(g).trim().toLowerCase()
  if (s === 'm' || s === 'male') return 'Male'
  if (s === 'f' || s === 'female') return 'Female'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const normalizePoliceOcrResponse = (response) => {
  const payload = response?.data?.data?.data || response?.data?.data || response?.data
  if (!payload) return null
  const digilockerMetadata = payload?.digilocker_metadata || {}
  const aadhaarXmlData = {
    ...payload?.aadhaar_xml_data,
    mobile:
      payload?.aadhaar_xml_data?.mobile ||
      payload?.aadhaar_xml_data?.phone_number ||
      digilockerMetadata?.mobile_number ||
      payload?.mobile ||
      payload?.mobile_number ||
      null,
  }

  return {
    ...payload,
    success: response?.data?.success ?? payload?.success,
    message: response?.data?.message ?? payload?.message,
    xml_url: payload?.xml_url || payload?.xmlUrl || null,
    client_id: payload?.client_id || payload?.clientId || null,
    aadhaar_xml_data: aadhaarXmlData,
    digilocker_metadata: digilockerMetadata,
  }
}

const findBiharPoliceStationByPincode = (pincode) => {
  const normalizedPincode = String(pincode || '').replace(/\D/g, '')
  if (normalizedPincode.length !== 6) return null
  const match = BIHAR_POLICE_STATIONS.find((entry) => String(entry.pincode || '').replace(/\D/g, '') === normalizedPincode)
  return match ? { policeStation: match.policeStation, nearestPoliceStationPincode: normalizedPincode } : null
}

const resolveBiharNearestPoliceStation = (candidate, ocrData) => {
  const existingStation = candidate?.nearestPoliceStation
  const existingPin = candidate?.nearestPolicePin
  if (existingStation && existingPin) {
    return { nearestPoliceStation: existingStation, nearestPolicePin: existingPin }
  }

  const zipFromOcr = ocrData?.aadhaar_xml_data?.zip ||
    ocrData?.aadhaar_xml_data?.address?.pincode ||
    ocrData?.aadhaar_xml_data?.pincode ||
    ocrData?.aadhaar_xml_data?.address?.po ||
    null

  const candidatePin = candidate?.pincode || candidate?.pin || candidate?.postalCode || candidate?.postal_code || null

  const lookupSources = [zipFromOcr, candidatePin].filter(Boolean)
  for (const pincode of lookupSources) {
    const match = findBiharPoliceStationByPincode(pincode)
    if (match) {
      return {
        nearestPoliceStation: match.policeStation,
        nearestPolicePin: match.nearestPoliceStationPincode,
      }
    }
  }

  const normalizedZipFromOcr = String(zipFromOcr || '').replace(/\D/g, '')
  if (normalizedZipFromOcr.length === 6) {
    return {
      nearestPoliceStation: existingStation || '',
      nearestPolicePin: normalizedZipFromOcr,
    }
  }

  const normalizedCandidatePin = String(candidatePin || '').replace(/\D/g, '')
  if (normalizedCandidatePin.length === 6) {
    return {
      nearestPoliceStation: existingStation || '',
      nearestPolicePin: normalizedCandidatePin,
    }
  }

  return {
    nearestPoliceStation: existingStation || '',
    nearestPolicePin: existingPin || '',
  }
}

const PoliceReportTemplate = ({ candidate = {}, ocrData = null }) => {
  const {
    id,
    name,
    mobile,
    email,
    location,
    gender,
    dob,
    fatherName,
    aadhaarNumber,
    aadhaarFront,
    aadhaarBack,
    profileImage,
    presentAddress,
    permanentAddress,
  } = candidate

  const xmlData = ocrData ? (ocrData.aadhaar_xml_data || {}) : null
  const registrationImage = profileImage || null
  const uidaiImage = xmlData && xmlData.profile_image ? `data:image/jpeg;base64,${xmlData.profile_image}` : null
  const candidateAddress = presentAddress || permanentAddress || location || '—'
  let nearestPoliceStation = candidate.nearestPoliceStation || ''
  let nearestPolicePin = candidate.nearestPolicePin || ''

  if (!nearestPoliceStation) nearestPoliceStation = '—'
  if (!nearestPolicePin) nearestPolicePin = '—'

  return (
    <div data-police-report-root style={{ padding: '12px 16px', width: '100%', maxWidth: '100%', margin: '0 auto', backgroundColor: '#ffffff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: 14, lineHeight: 1.3, boxSizing: 'border-box' }}>
      

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Registration photo</div>
          <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170 }}>
            {registrationImage ? (
              <img src={registrationImage} alt="Registration" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: 10 }}>No photo</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Photo as per UIDAI</div>
          <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170 }}>
            {uidaiImage ? (
              <img src={uidaiImage} alt="UIDAI" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: 10 }}>No photo</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ border: '2px solid #000', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', backgroundColor: '#e8e8e8', padding: '5px 8px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
            <span>Online registration Data</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>ID : {id || 'N/A'}</span>
          </div>
          <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, alignSelf: 'center' }}>
            Data from UIDAI
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '2px solid #000', padding: '5px 8px' }}>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Name:</span> <span>{name || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Fathers name:</span> <span>{fatherName || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Date of birth:</span> <span>{formatPdfDate(dob) || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Gender:</span> <span>{gender || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Aadhaar no:</span> <span>{aadhaarNumber || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Mobile no:</span> <span>{mobile ? `+91-${mobile}` : '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13 }}>
              <span style={{ fontWeight: 700, minWidth: 80 }}>Address:</span>
              <span>
                {candidateAddress}
                {(candidate.pincode || candidate.pin || candidate.postalCode) ? ` (PIN: ${candidate.pincode || candidate.pin || candidate.postalCode})` : ''}
              </span>
            </div>
          </div>
          <div style={{ padding: '5px 8px' }}>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Name:</span> <span>{xmlData?.full_name || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Fathers name:</span> <span>{xmlData?.father_name || xmlData?.care_of || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Date of birth:</span> <span>{formatPdfDate(xmlData?.dob) || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}>
              <span style={{ fontWeight: 700, minWidth: 80 }}>Gender:</span>
              <span>{xmlData ? formatGender(xmlData?.gender) : '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Aadhaar no:</span> <span>{xmlData?.masked_aadhaar || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Mobile no:</span> <span>{xmlData?.mobile || xmlData?.phone_number || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13 }}>
              <span style={{ fontWeight: 700, minWidth: 80 }}>Address:</span>
              <span>
                {xmlData?.full_address || '—'}
                {(xmlData?.zip || xmlData?.address?.po || xmlData?.address?.pincode || xmlData?.pincode) ? ` (PIN: ${xmlData?.zip || xmlData?.address?.po || xmlData?.address?.pincode || xmlData?.pincode})` : ''}
              </span>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', padding: '5px 8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid #000' }}>
            <div style={{ display: 'flex', gap: 2, fontSize: 13 }}><span style={{ fontWeight: 700, minWidth: 180 }}>Nearest police station:</span> <span>{nearestPoliceStation || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: 13 }}><span style={{ fontWeight: 700, minWidth: 180 }}>Nearest police station pin code:</span> <span>{nearestPolicePin || '—'}</span></div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.3 }}>
        These data will be used to obtain the Police Certificate from the nearest police station
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          {/* <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Aadhaar Front</div> */}
          <div style={{ border: '2px solid #000', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
            {aadhaarFront ? (
              <img src={aadhaarFront} alt="Aadhaar Front" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: 10 }}>Not available</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Aadhaar Back</div> */}
          <div style={{ border: '2px solid #000', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
            {aadhaarBack ? (
              <img src={aadhaarBack} alt="Aadhaar Back" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: 10 }}>Not available</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ border: '2px solid #000', marginBottom: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: 0 }}>
        <div style={{ borderRight: '2px solid #000', minHeight: 90, padding: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Signature English</div>
        </div>
        <div style={{ minHeight: 90, padding: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Signature Hindi</div>
        </div>
        <div style={{ gridColumn: '1 / -1', borderTop: '2px solid #000', minHeight: 250, padding: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Verification Report of PS.</div>
        </div>
      </div>

      
    </div>
  )
}


const KycReportTemplate = ({ candidate = {}, ocrData = null, agreementMode = false }) => {
  const {
    id,
    name,
    mobile,
    email,
    location,
    gender,
    dob,
    fatherName,
    aadhaarNumber,
    aadhaarFront,
    aadhaarBack,
    profileImage,
    presentAddress,
    permanentAddress,
    district,
    centre,
    centreCode,
  } = candidate
  const baseFontSize = agreementMode ? 18 : 14
  const detailFontSize = agreementMode ? 16 : 13
  const headerFontSize = agreementMode ? 18 : 14
  const noteFontSize = agreementMode ? 16 : 10

  const xmlData = ocrData ? (ocrData.aadhaar_xml_data || {}) : null
  const registrationImage = profileImage || null
  const uidaiImage = xmlData && xmlData.profile_image ? `data:image/jpeg;base64,${xmlData.profile_image}` : null
  const candidateAddress = presentAddress || permanentAddress || location || '—'

  return (
    <div data-kyc-report-root style={{ padding: '12px 16px', width: '100%', maxWidth: '100%', margin: '0 auto', backgroundColor: '#ffffff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: baseFontSize, lineHeight: 1.35, boxSizing: 'border-box' }}>
      <div style={{ border: '2px solid #000', marginBottom: 10, padding: '10px 12px' }}>
        <div style={{ fontSize: headerFontSize + 1, fontWeight: 700, marginBottom: 6 }}>KYC Report</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', fontSize: detailFontSize }}>
          <span><strong>District:</strong> {district || '—'}</span>
          <span><strong>Centre:</strong> {centre || '—'}</span>
          <span><strong>Centre Code:</strong> {centreCode || '—'}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: headerFontSize, fontWeight: 700, marginBottom: 4 }}>Registration Photo</div>
          <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170 }}>
            {registrationImage ? (
              <img src={registrationImage} alt="Registration" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: noteFontSize }}>No photo</span>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: headerFontSize, fontWeight: 700, marginBottom: 4 }}>Photo as per UIDAI</div>
          <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 170 }}>
            {uidaiImage ? (
              <img src={uidaiImage} alt="UIDAI" style={{ maxWidth: '100%', maxHeight: 160, objectFit: 'contain' }} />
            ) : (
              <span style={{ color: '#999', fontSize: noteFontSize }}>No photo</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ border: '2px solid #000', marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', backgroundColor: '#e8e8e8', padding: '5px 8px' }}>
          <div style={{ fontWeight: 700, fontSize: detailFontSize }}>Candidate Details</div>
          <div style={{ fontWeight: 700, fontSize: detailFontSize }}>Data from UIDAI</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ borderRight: '2px solid #000', padding: '5px 8px' }}>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Name:</span> <span>{name || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Father's name:</span> <span>{fatherName || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Date of birth:</span> <span>{formatPdfDate(dob) || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Gender:</span> <span>{gender || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Aadhaar no:</span> <span>{aadhaarNumber || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize }}><span style={{ fontWeight: 700, minWidth: 80 }}>Mobile no:</span> <span>{mobile ? `+91-${mobile}` : '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, marginTop: 2 }}>
              <span style={{ fontWeight: 700, minWidth: 80 }}>Address:</span>
              <span>{candidateAddress}</span>
            </div>
          </div>
          <div style={{ padding: '5px 8px' }}>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Name:</span> <span>{xmlData?.full_name || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Father's name:</span> <span>{xmlData?.father_name || xmlData?.care_of || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Date of birth:</span> <span>{formatPdfDate(xmlData?.dob) || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Gender:</span> <span>{xmlData ? formatGender(xmlData?.gender) : '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, borderBottom: '1px solid #ccc', paddingBottom: 2, marginBottom: 2 }}><span style={{ fontWeight: 700, minWidth: 80 }}>Aadhaar no:</span> <span>{xmlData?.masked_aadhaar || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize }}><span style={{ fontWeight: 700, minWidth: 80 }}>Mobile no:</span> <span>{xmlData?.mobile || xmlData?.phone_number || '—'}</span></div>
            <div style={{ display: 'flex', gap: 2, fontSize: detailFontSize, marginTop: 2 }}>
              <span style={{ fontWeight: 700, minWidth: 80 }}>Address:</span>
              <span>{xmlData?.full_address || '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {agreementMode ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, backgroundColor: '#fff' }}>
              {aadhaarFront ? (
                <img src={aadhaarFront} style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 260 }} />
              ) : (
                <span style={{ color: '#999', fontSize: noteFontSize }}>Not available</span>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, backgroundColor: '#fff' }}>
              {aadhaarBack ? (
                <img src={aadhaarBack} style={{ width: '100%', height: '100%', objectFit: 'cover', maxHeight: 260 }} />
              ) : (
                <span style={{ color: '#999', fontSize: noteFontSize }}>Not available</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Aadhaar Front</div>
            <div style={{ border: '2px solid #000', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              {aadhaarFront ? (
                <img src={aadhaarFront} alt="Aadhaar Front" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
              ) : (
                <span style={{ color: '#999', fontSize: 10 }}>Not available</span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Aadhaar Back</div>
            <div style={{ border: '2px solid #000', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              {aadhaarBack ? (
                <img src={aadhaarBack} alt="Aadhaar Back" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
              ) : (
                <span style={{ color: '#999', fontSize: 10 }}>Not available</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const generateKycReportPDF = async (candidateId, rowData = null) => {
  try {
    const [candidateResult, ocrResult] = await Promise.allSettled([
      recruiterAPI.getCandidateById(candidateId, { silent: true }),
      recruiterAPI.getAadhaarOcrVerification(candidateId, { silent: true }),
    ])

    if (candidateResult.status !== 'fulfilled') {
      console.warn('Failed to fetch candidate for KYC report:', candidateResult.reason)
      return { error: 'failed_to_fetch_candidate' }
    }

    const candidate = normalizePoliceCandidateResponse(candidateResult.value)

    if (rowData) {
      candidate.district = candidate.district || rowData.district || ''
      candidate.centre = candidate.centre || rowData.centre || ''
      candidate.centreCode = candidate.centreCode || rowData.centreCode || rowData.centerid || ''
    }

    let ocrData = null
    if (ocrResult.status === 'fulfilled') {
      try {
        ocrData = normalizePoliceOcrResponse(ocrResult.value)
      } catch (e) {
        console.warn('Failed to normalize OCR response for KYC report; proceeding without OCR data', e)
        ocrData = null
      }
    } else {
      console.warn('Aadhaar OCR fetch failed; generating KYC report without OCR data:', ocrResult.reason)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Aadhaar OCR unavailable for ${candidateId}; generating KYC report without OCR data`, duration: 3000 }
      }))
      ocrData = null
    }

    try {
      if (candidate?.aadhaarFront) {
        const frontUrl = await getDisplayableImageUrl(candidate.aadhaarFront)
        if (frontUrl) candidate.aadhaarFront = frontUrl
      }
      if (candidate?.aadhaarBack) {
        const backUrl = await getDisplayableImageUrl(candidate.aadhaarBack)
        if (backUrl) candidate.aadhaarBack = backUrl
      }
      if (candidate?.profileImage) {
        const profileUrl = await getDisplayableImageUrl(candidate.profileImage)
        if (profileUrl) candidate.profileImage = profileUrl
      }
    } catch (imgErr) {
      console.warn('Image conversion error for KYC report; proceeding with original URLs', imgErr)
    }

    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.padding = '0px'
    tempContainer.style.borderRadius = '0px'
    tempContainer.innerHTML = '<div id="kyc-report-export-container"></div>'
    document.body.appendChild(tempContainer)

    const exportContainer = tempContainer.querySelector('#kyc-report-export-container')
    const root = ReactDOM.createRoot(exportContainer)
    root.render(<KycReportTemplate candidate={candidate} ocrData={ocrData} />)

    const waitTimeout = 30000
    const pollInterval = 200
    let waited = 0
    let exportRoot = exportContainer.querySelector('[data-kyc-report-root]')
    while (!exportRoot && waited < waitTimeout) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, pollInterval))
      waited += pollInterval
      exportRoot = exportContainer.querySelector('[data-kyc-report-root]')
    }

    if (!exportRoot) {
      try { root.unmount() } catch (e) {}
      document.body.removeChild(tempContainer)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Skipped candidate ${candidateId} - failed to load KYC report details`, duration: 2000 }
      }))
      return { error: 'failed_to_load_kyc_report_details' }
    }

    const images = exportRoot.querySelectorAll('img')
    await Promise.all(Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    }))

    const canvas = await html2canvas(exportRoot, {
      scale: HTML2CANVAS_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: exportRoot.scrollWidth,
      height: exportRoot.scrollHeight,
      windowWidth: exportRoot.scrollWidth,
      windowHeight: exportRoot.scrollHeight,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const imgData = canvas.toDataURL('image/jpeg', 0.8)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    let imgWidth = pdfWidth
    let imgHeight = (imgProps.height * pdfWidth) / imgProps.width
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight
      imgWidth = (imgProps.width * pdfHeight) / imgProps.height
    }
    let heightLeft = imgHeight
    pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, 0, imgWidth, imgHeight)
    heightLeft -= pdfHeight
    while (heightLeft > 0) {
      const position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    try { root.unmount() } catch (e) {}
    document.body.removeChild(tempContainer)
    const pdfBlob = pdf.output('blob')
    return { blob: pdfBlob }
  } catch (err) {
    console.error('generateKycReportPDF error:', err)
    return { error: err?.message || 'generate_error' }
  }
}

const generatePoliceReportPDF = async (candidateId) => {
  try {
    const [candidateResult, ocrResult] = await Promise.allSettled([
      recruiterAPI.getCandidateById(candidateId, { silent: true }),
      recruiterAPI.getAadhaarOcrVerification(candidateId, { silent: true }),
    ])

    if (candidateResult.status !== 'fulfilled') {
      console.warn('Failed to fetch candidate for police report:', candidateResult.reason)
      return { error: 'failed_to_fetch_candidate' }
    }

    const candidate = normalizePoliceCandidateResponse(candidateResult.value)

    let ocrData = null
    if (ocrResult.status === 'fulfilled') {
      try {
        ocrData = normalizePoliceOcrResponse(ocrResult.value)
      } catch (e) {
        console.warn('Failed to normalize OCR response; proceeding without OCR data', e)
        ocrData = null
      }
    } else {
      // OCR failed; do NOT fallback to OCR-derived values — proceed with null
      console.warn('Aadhaar OCR fetch failed; generating police report without OCR data:', ocrResult.reason)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Aadhaar OCR unavailable for ${candidateId}; generating report without OCR data`, duration: 3000 }
      }))
      ocrData = null
    }

    const resolvedPoliceStation = resolveBiharNearestPoliceStation(candidate, ocrData)
    if (resolvedPoliceStation.nearestPoliceStation) {
      candidate.nearestPoliceStation = resolvedPoliceStation.nearestPoliceStation
    }
    if (resolvedPoliceStation.nearestPolicePin) {
      candidate.nearestPolicePin = resolvedPoliceStation.nearestPolicePin
    }

    // Convert potential HEIC images to displayable URLs before rendering
    try {
      if (candidate?.aadhaarFront) {
        const frontUrl = await getDisplayableImageUrl(candidate.aadhaarFront)
        if (frontUrl) candidate.aadhaarFront = frontUrl
      }
      if (candidate?.aadhaarBack) {
        const backUrl = await getDisplayableImageUrl(candidate.aadhaarBack)
        if (backUrl) candidate.aadhaarBack = backUrl
      }
      if (candidate?.profileImage) {
        const profileUrl = await getDisplayableImageUrl(candidate.profileImage)
        if (profileUrl) candidate.profileImage = profileUrl
      }
    } catch (imgErr) {
      console.warn('Image conversion error; proceeding with original URLs', imgErr)
    }

    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.padding = '0px'
    tempContainer.style.borderRadius = '0px'
    tempContainer.innerHTML = '<div id="police-report-export-container"></div>'
    document.body.appendChild(tempContainer)

    const exportContainer = tempContainer.querySelector('#police-report-export-container')
    const root = ReactDOM.createRoot(exportContainer)
    root.render(<PoliceReportTemplate candidate={candidate} ocrData={ocrData} />)

    const waitTimeout = 30000
    const pollInterval = 200
    let waited = 0
    let exportRoot = exportContainer.querySelector('[data-police-report-root]')
    while (!exportRoot && waited < waitTimeout) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, pollInterval))
      waited += pollInterval
      exportRoot = exportContainer.querySelector('[data-police-report-root]')
    }

    if (!exportRoot) {
      try { root.unmount() } catch (e) {}
      document.body.removeChild(tempContainer)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Skipped candidate ${candidateId} - failed to load police report details`, duration: 2000 }
      }))
      return { error: 'failed_to_load_police_report_details' }
    }

    const images = exportRoot.querySelectorAll('img')
    await Promise.all(Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve()
      return new Promise((resolve) => {
        img.onload = resolve
        img.onerror = resolve
      })
    }))

    const canvas = await html2canvas(exportRoot, {
      scale: HTML2CANVAS_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: exportRoot.scrollWidth,
      height: exportRoot.scrollHeight,
      windowWidth: exportRoot.scrollWidth,
      windowHeight: exportRoot.scrollHeight,
    })

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const imgData = canvas.toDataURL('image/jpeg', 0.8)
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    let imgWidth = pdfWidth
    let imgHeight = (imgProps.height * pdfWidth) / imgProps.width
    if (imgHeight > pdfHeight) {
      imgHeight = pdfHeight
      imgWidth = (imgProps.width * pdfHeight) / imgProps.height
    }
    let heightLeft = imgHeight
    pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, 0, imgWidth, imgHeight)
    heightLeft -= pdfHeight
    while (heightLeft > 0) {
      const position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, position, imgWidth, imgHeight)
      heightLeft -= pdfHeight
    }

    try { root.unmount() } catch (e) {}
    document.body.removeChild(tempContainer)
    const pdfBlob = pdf.output('blob')
    return { blob: pdfBlob }
  } catch (err) {
    console.error('generatePoliceReportPDF error:', err)
    return { error: err?.message || 'generate_error' }
  }
}

const buildAgreementTermItems = (agreementData = {}) => {
  const {
    recruitmentInfo = '',
    recruitmentFor = '',
    numberOfVenues = '',
    venueName = '',
    centreCode = '',
    projectEndDate = '',
    reportingTimeFrom = '',
    reportingTimeTo = '',
    governingState = '',
    bpsscConsent = '',
    companyConsent = '',
    inrPerDay = '',
    panNumber = '',
  } = agreementData

  return [
    <li key="term-1" style={{ marginBottom: 6 }}>
      I agree to work for this recruitment (<strong>{recruitmentFor || '______'}</strong>) which will be conducted in <strong>{numberOfVenues || '___'}</strong> venues at <strong>{venueName || '______'}</strong> / Centre Code <strong>{centreCode || '______'}</strong>.
    </li>,
    <li key="term-2" style={{ marginBottom: 6 }}>
      I agree to work in a consultant position as a <strong>{agreementData.designation || 'Consultant'}</strong> to provide and support team members during the project.
    </li>,
    <li key="term-3" style={{ marginBottom: 6 }}>
      I agree to work in this project until <strong>{formatPdfDate(projectEndDate) || '______'}</strong> i.e., until the completion of this project at this venue, without Backing off during the project duration and I completely agree to any penalties if I leave the project during the project duration including deduction of salary. I agree with the decision of the company in deducting the salary if I leave the project during the project execution.
    </li>,
    <li key="term-4" style={{ marginBottom: 6 }}>
      I abide by the reporting time which will be between <strong>{reportingTimeFrom || '—'}</strong> and <strong>{reportingTimeTo || '—'}</strong> and attendance will be captured through biometric fingerprint and photography. I agree that I will not be paid salary for a particular day if biometric & photography is not captured nor give for attendance on the same day.
    </li>,
    <li key="term-5" style={{ marginBottom: 6 }}>
      I shall follow the daily project schedule as per the instructions of the project head and I shall not violate any official order given by Reporting Head & client.
    </li>,
    <li key="term-6" style={{ marginBottom: 6 }}>
      I shall be careful while entering the data into the computer and shall not tamper with it.
    </li>,
    <li key="term-7" style={{ marginBottom: 6 }}>
      I understand that tampering or wrong input will result in expulsion and prompt action will be taken against me, and I shall fully cooperate with officials and the company to take legal action against me.
    </li>,
    <li key="term-8" style={{ marginBottom: 6 }}>
      No data or technology in relation to the project will be shared or discussed with anyone other than the members associated with the project, and I understand that any such breach should be considered as a breach of contract, And I shall fully cooperate with officials and the company to take legal action against me.
    </li>,
    <li key="term-9" style={{ marginBottom: 6 }}>
      No external data device (Mobile/Pen Drive/Hard Disk. Any other storing devices) will be allowed and used inside the premises. I ensure copying of data through any medium or source will be strictly prohibited and is also an offense under the Data Protection Act.
    </li>,
    <li key="term-10" style={{ marginBottom: 6 }}>
      I promise that I have not applied nor participate in the current recruitment/examination as a candidate and I also promise that none of my direct dependent nor relative have applied nor participating in the ongoing recruitment/examination. If found, I shall fully cooperate with officials and the company to take legal action against me.
    </li>,
    <li key="term-11" style={{ marginBottom: 6 }}>
      I promise that all the equipment(s) & data provided in the course of work shall be returned to the Company without any damage, under no circumstances none of the equipment(s)/data be taken out of the work site. I agree with the decision of the company to deduct the salary if any damage to equipment or hardware is done under my purview. If the cost of equipment or hardware that has been damaged or lost is more than my salary, I agree to pay the same amount to the company within seven (7) days of the damaged/lost item.
    </li>,
    <li key="term-12" style={{ marginBottom: 6 }}>
      This Agreement shall be governed by the laws of the State of <strong>{governingState || '______'}</strong>. If there is any legal action against me, I agree to appear in court at my own expense and will not claim any expenses/amount from the company.
    </li>,
    <li key="term-13" style={{ marginBottom: 6 }}>
      I agree that I shall not share/transfer any Confidential Information about the current recruitment/examination conducted by <strong>{recruitmentFor || '______'}</strong> or contrary to law, or for any other reason. I agree to all the confidentiality obligations which shall apply during the term of this Agreement and as well after the completion of the project also.
    </li>,
    <li key="term-14" style={{ marginBottom: 6 }}>
      Without the written consent of the <strong>{recruitmentInfo || '______'}</strong> nor <strong>{companyConsent || '______'}</strong> To you, I shall not use Intellectual Property nor information nor data for any other purpose which is stipulated in the contract of the project. I shall be responsible for any damage resulting from unauthorized use of Intellectual Property or Information or data belonging to the current recruitment as well as <strong>{recruitmentInfo || '______'}</strong> department.
    </li>,
    <li key="term-15" style={{ marginBottom: 6 }}>
      The company will not be responsible for any mistakes made by me and I will face legal action/judicial inquiry for the mistakes made by me. The company will not be bound for any wrongdoing committed by me and I agree that I will not be provided with any legal aid from the company in case of such misconduct done by me or supported by me in any way leading to malpractice or misconduct or impersonation during the ongoing recruitment.
    </li>,
    <li key="term-16" style={{ marginBottom: 6 }}>
      The Public Examinations (Prevention of Unfair Means) Bill, 2024 was introduced in Lok Sabha on February 5, 2024. The Bill seeks to prevent the use of unfair means in public examinations. Public examinations refer to examinations conducted by authorities specified under the Schedule to the Bill or notified by the central government. These include: (i) Union Public Service Commission, (ii) Staff Selection Commission, (iii) Railway Recruitment Board, (iv) National Testing Agency, (v) Institute of Banking Personnel Selection, and (vi) Departments of the central government and their attached offices for recruitment.
    </li>,
    <li key="term-17" style={{ marginBottom: 6 }}>
      Offences in relation to public examinations: The Bill defines several offences in relation to public examinations. It prohibits collusion or conspiracy to facilitate indulgence in any unfair means. It specifies unfair meansto include: (i) unauthorized access or leakage of question paper or answer key, (ii) assisting a candidate during a public examination, (iii) tampering with computer network or resources, (iv) tampering with documents for shortlisting or finalizing of merit list or rank, and (v) conducting fake examination, issuing fake admit cards or offer letters to cheat, for monetary gain. It also prohibits: (i) disclosing exam-related confidential information before time, and (ii) unauthorized people from entering exam centers to create disruptions The above offences will be punishable with imprisonment between three and five years, and a fine up to Rs 10 lakh.
    </li>,
    <li key="term-18" style={{ marginBottom: 6 }}>
      Inquiry and investigation: All offences under the Bill will be cognizable, non-bailable, and non-compoundable. No action will count as an offence if it is proved that the accused had exercised due diligence. An officer not below the rank Deputy Superintendent or Assistant Commissioner of Police will investigate the offences under the Act. The central government may transfer the investigation to any central investigating agency
    </li>,
    <li key="term-19" style={{ marginBottom: 6 }}>
      Consultancy Charges will be INR <strong>{inrPerDay || '______'}</strong> per working day. The same will be credited to your bank account on a monthly basis after completion of the work. PAN NO <strong>{panNumber || '_____________________________'}</strong>
    </li>,
    <li key="term-20" style={{ marginBottom: 6 }}>
      I will refrain from directly engaging with officials and candidates.
    </li>,
    <li key="term-21" style={{ marginBottom: 6 }}>
      I will make myself available in formals.
    </li>,
  ]
}

const AgreementTemplate = ({ candidate = {}, agreementData = {}, pageNumber = 1, totalPages = 2 }) => {
  const {
    name = '',
    mobile = '',
    fatherName = '',
    aadhaarNumber = '',
    presentAddress = '',
    permanentAddress = '',
    profileImage = '',
    aadhaarFront = '',
    aadhaarBack = '',
  } = candidate

  const {
    dateOfAgreement = '',
    recruitmentInfo = '',
    numberOfVenues = '',
    venueName = '',
    centreCode = '',
    reportingTimeFrom = '',
    reportingTimeTo = '',
    projectEndDate = '',
    witnessName = '',
    witnessDesignation = '',
    inrPerDay = '',
    governingState = '',
    bpsscConsent = '',
    companyConsent = '',
  } = agreementData

  const candidateAddress = presentAddress || permanentAddress || ''
  const agreementTerms = buildAgreementTermItems(agreementData)
  const termsForPage = pageNumber === 1 ? agreementTerms.slice(0, 10) : agreementTerms.slice(10)
  const isLastPage = pageNumber === totalPages
  const showHeader = pageNumber === 1
  const olStart = pageNumber === 2 ? 11 : 1
  const displayValue = (value, placeholder = '_________________________') => (value ? value : placeholder)
  const designationLabel = agreementData.designation || candidate.designation || 'Consultant'

  return (
    <div
      data-agreement-report-root
      style={{
        padding: '16px 18px',
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000',
        fontFamily: 'Arial, sans-serif',
        fontSize: '9.5pt',
        lineHeight: 1.35,
        boxSizing: 'border-box',
      }}
    >
      {showHeader ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #000' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14.5pt', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' }}>Confidentiality and Non-Disclosure Agreement</div>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ fontSize: '9.5pt', lineHeight: 1.45 }}>
                <div style={{ marginBottom: '6px' }}>
                  Full Name as per Aadhaar: <strong>{displayValue(name)}</strong>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  Father's Name: <strong>{displayValue(fatherName)}</strong>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  Aadhaar Number: <strong>{displayValue(aadhaarNumber)}</strong>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  Current Residing Address: <strong>{displayValue(presentAddress)}</strong>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  Permanent Address: <strong>{displayValue(permanentAddress)}</strong>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  Date of Agreement: <strong>{displayValue(formatPdfDate(dateOfAgreement))}</strong>
                </div>
              </div>
              <div style={{ width: '130px', textAlign: 'center', marginLeft: '14px' }}>
              <div style={{ border: '1px solid #000', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                {profileImage ? (
                  <img src={profileImage} alt="Passport" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '9pt', color: '#999' }}>Not available</span>
                )}
              </div>
            </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <div style={{ marginBottom: '12px', fontSize: '9.5pt' }}>
        {showHeader ? (
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '9.5pt' }}>Terms and Conditions and scope of work</div>
        ) : null}
        <ol start={olStart} style={{ margin: 0, paddingLeft: '20px', fontSize: '9pt', lineHeight: 1.5 }}>
          {termsForPage}
        </ol>
      </div>

      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px', marginTop: '14px' }}>
          <div style={{ fontSize: '10pt' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{designationLabel} Name</div>
            <div style={{ minHeight: '28px', marginBottom: '10px' }}>{displayValue(name)}</div>
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{designationLabel} Signature</div>
            <div style={{ borderBottom: '1px solid #000', minHeight: '28px' }} />
          </div>
          <div style={{ fontSize: '10pt' }}>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '6px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Witness Name/Designation</div>
            <div style={{  minHeight: '28px', marginBottom: '10px' }}>{displayValue(witnessName ? `${witnessName}${witnessDesignation ? ' / ' + witnessDesignation : ''}` : '')}</div>
            </div>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Witness Signature</div>
            <div style={{ borderBottom: '1px solid #000', minHeight: '28px' }} />
          </div>
        </div>

        {pageNumber === 1 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', fontSize: '9pt', letterSpacing: '0.5px' }}>
              </div>
              <div style={{ marginTop: '6px', fontSize: '8.5pt', fontWeight: 700 }}>LTI for consultant</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', fontSize: '9pt', letterSpacing: '0.5px' }}>
              </div>
              <div style={{ marginTop: '6px', fontSize: '8.5pt', fontWeight: 700 }}>LTI for witness</div>
            </div>
          </div>
        ) : null}
      </>

      {pageNumber === 2 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', fontSize: '9pt', letterSpacing: '0.5px' }}>
              <span style={{ color: '#999' }}></span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '8.5pt', fontWeight: 700 }}>LTI for consultant</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', fontSize: '9pt', letterSpacing: '0.5px' }}>
              <span style={{ color: '#999' }}></span>
            </div>
            <div style={{ marginTop: '6px', fontSize: '8.5pt', fontWeight: 700 }}>LTI for witness</div>
          </div>
        </div>
      ) : null}

      {isLastPage && pageNumber !== 2 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginTop: '14px', marginBottom: '14px' }}>
            <div style={{ fontSize: '10pt' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{designationLabel} Signature</div>
                <div style={{ borderBottom: '1px solid #000', minHeight: '36px', marginBottom: '10px' }} />
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>{designationLabel} Name</div>
                <div style={{  minHeight: '36px', marginBottom: '10px' }}>{displayValue(name)}</div>
                <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', letterSpacing: '0.5px', margin: '0 auto' }}>
                </div>
              </div>
              <div style={{ fontSize: '10pt' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Witness Signature</div>
                <div style={{ borderBottom: '1px solid #000', minHeight: '36px', marginBottom: '10px' }} />
                <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>Witness Name/Designation</div>
                <div style={{  minHeight: '36px', marginBottom: '10px' }}>{displayValue(witnessName ? `${witnessName}${witnessDesignation ? ' / ' + witnessDesignation : ''}` : '')}</div>
                <div style={{ width: '140px', height: '52px', border: '1px solid #000', borderRadius: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', letterSpacing: '0.5px', margin: '0 auto' }}>
                </div>
              </div>
        </div>
      ) : null}
    </div>
  )
}

const AgreementPageLayout = ({ candidate = {}, agreementData = {}, ocrData = null, pageNumber = 1, totalPages = 1, offsetY = 0 }) => {
  const pageWidthPx = 794
  const pageHeightPx = 1123

  return (
    <div
      data-agreement-page-root
      style={{
        width: `${pageWidthPx}px`,
        height: `${pageHeightPx}px`,
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '26px',
        color: '#000',
      }}
    >
      <div
        style={{
          width: '100%',
          flex: '1 1 auto',
          overflow: 'hidden',
        }}
      >
        {pageNumber === 3 ? (
          <KycReportTemplate candidate={candidate} ocrData={ocrData} agreementMode={true} />
        ) : pageNumber === 4 ? (
          <PoliceReportTemplate candidate={candidate} ocrData={ocrData} />
        ) : (
          <AgreementTemplate candidate={candidate} agreementData={agreementData} pageNumber={pageNumber} totalPages={totalPages} />
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid #ccc',
          paddingTop: '4px',
          fontSize: '7pt',
          lineHeight: 1.2,
          color: '#333',
          textAlign: 'center',
        }}
      >
        <span>
          This document contains confidential information. The content in this document is intended for the Consultant or entity to which it is addressed only. If you are not the person to whom this message is addressed, be aware that any use, reproduction, or distribution of this message is strictly prohibited and legal action will be taken against you. | If you received this in error, please contact the consultant or entity and immediately delete this document.
        </span>
      </div>
    </div>
  )
}

const OfferLetterPageLayout = ({ candidate = {}, offerData = {}, pageNumber = 1, totalPages = 3, editable = false, onChange = () => {} }) => {
  const inputStyle = { border: 'none', borderBottom: '1px dashed #1687ad', background: 'rgba(22, 135, 173, 0.06)', color: '#075b78', font: 'inherit', fontWeight: 700, padding: '0 2px', minWidth: 80, maxWidth: '100%' }
  const value = (key, fallback = '__________') => editable ? <input aria-label={key} value={offerData[key] || ''} placeholder={fallback} onChange={(event) => onChange(key, event.target.value)} style={inputStyle} /> : (offerData[key] || fallback)
  const personNameValue = (key, fallback = '__________') => editable ? value(key, fallback) : (formatPersonName(offerData[key]) || fallback)
  const dateValue = (key) => editable ? <input aria-label={key} type="date" value={offerData[key] || ''} onChange={(event) => onChange(key, event.target.value)} style={inputStyle} /> : formatPdfDate(value(key))
  const address = candidate.district || '__________'
  const candidateName = formatPersonName(candidate.name) || '__________'
  const sectionStyle = { marginBottom: 14 }
  const headingStyle = { fontSize: '12pt', fontWeight: 700, marginBottom: 6 }
  const itemStyle = { marginBottom: 5 }
  const pageContent = pageNumber === 1 ? (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 12, marginBottom: 18 }}>
        <img src={`${import.meta.env.BASE_URL}cyno-logo.png`} alt="Cynosure Corporate Solutions" width="220" height="110" style={{ display: 'block', width: 220, height: 110, maxWidth: '45%', objectFit: 'contain' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>To,<br /><strong>{candidateName}</strong><br />{address}</div>
        <div style={{ textAlign: 'right' }}>Date: {dateValue('offerDate')}</div>
      </div>
      <div style={{ marginBottom: 14 }}><strong>Subject: Offer for {value('assignmentType', 'Short-Term Project')} Assignment - {value('projectLocation', 'Uttar Pradesh')}</strong></div>
      <div style={{ marginBottom: 12 }}>Dear {candidateName},</div>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Congratulations!</div>
      <p style={{ margin: '0 0 10px' }}>We are pleased to inform you that you have been shortlisted for a {value('assignmentType', 'short-term project')} assignment in {value('projectLocation', 'Uttar Pradesh')}. Based on the project requirements, you will initially undergo training in {value('trainingLocation', 'Lucknow, Uttar Pradesh')} and, upon successful completion of the training, you will be deputed to any one of the designated districts in {value('projectLocation', 'Uttar Pradesh')}.</p>
      <p style={{ margin: '0 0 20px' }}>Please find below the terms and conditions of your project assignment:</p>
      <div style={sectionStyle}>
        <div style={headingStyle}>1. Project Details</div>
        <div style={itemStyle}><strong>Nature of Assignment:</strong> {value('assignmentType', 'Short-Term Project')}</div>
        <div style={itemStyle}><strong>Project Location:</strong> {value('projectLocation', 'Uttar Pradesh')}</div>
        <div style={itemStyle}><strong>Project Start Date:</strong> {dateValue('projectStartDate')}</div>
        <div style={itemStyle}><strong>Project Duration:</strong> {value('projectDuration', 'Till 2nd October 2026')}</div>
        <div style={itemStyle}><strong>Reserve Day:</strong> {value('reserveDay', '2nd October 2026')}</div>
        <div style={itemStyle}><strong>Project Reporting Time:</strong> {value('projectReportingTime', '4:00 AM')} at the assigned project location</div>
        <div style={itemStyle}><strong>District Deployment:</strong> {value('districtDeployment', 'Any one of the 15 districts in Uttar Pradesh, based on project requirements.')}</div>
      </div>
      <div style={sectionStyle}>
        <div style={headingStyle}>2. Initial Training</div>
        <div style={itemStyle}><strong>Training Location:</strong> {value('trainingLocation', 'Lucknow, Uttar Pradesh')}</div>
        <div style={itemStyle}><strong>Training Reporting Date:</strong> {dateValue('trainingReportingDate')}</div>
        <div style={itemStyle}><strong>Training Start Date:</strong> {dateValue('trainingStartDate')}</div>
        <div style={itemStyle}><strong>Training Reporting Time:</strong> {value('trainingReportingTime', '9:00 AM')}</div>
        <div style={itemStyle}><strong>Training Duration:</strong> {value('trainingDuration', '4 days')}</div>
        <p style={{ margin: '8px 0 0' }}>Successful completion of the training is mandatory for further deployment to the assigned project location.</p>
        <p style={{ margin: '8px 0 0' }}>The company reserves the right to assign the candidate to any one of the 15 districts in {value('projectLocation', 'Uttar Pradesh')} based on operational and project requirements.</p>
      </div>
    </>
  ) : pageNumber === 2 ? (
    <>
      <div style={sectionStyle}><div style={headingStyle}>3. Travel from Hometown to {value('trainingLocation', 'Lucknow')}</div><p style={{ margin: '0 0 8px' }}>The candidate will be required to make their own travel arrangements from their current location/hometown to {value('trainingLocation', 'Lucknow')} for the initial training.</p><p style={{ margin: '0 0 6px' }}>The company will reimburse the eligible travel expenses subject to the following conditions:</p><ul style={{ margin: 0, paddingLeft: 20 }}><li style={itemStyle}>Maximum approved travel reimbursement: {value('travelReimbursement', '₹1,800')}</li><li style={itemStyle}>The candidate must book the train ticket within the approved limit.</li><li style={itemStyle}>Any amount exceeding the approved limit will not be reimbursed.</li><li style={itemStyle}>The candidate must submit the valid train ticket and/or required proof of travel after reaching {value('trainingLocation', 'Lucknow')}.</li><li style={itemStyle}>Reimbursement will be subject to verification and applicable company/project guidelines.</li></ul><p style={{ margin: '8px 0 0' }}>Candidates are advised to verify the ticket fare before booking their journey.</p></div>
      <div style={sectionStyle}><div style={headingStyle}>4. Accommodation</div><p style={{ margin: 0 }}>Accommodation will be provided by the company during the training and project period, as per the project arrangements. Candidates are not required to make independent accommodation arrangements unless specifically instructed by the company.</p></div>
      <div style={sectionStyle}><div style={headingStyle}>5. Food Allowance</div><p style={{ margin: '0 0 6px' }}>Food arrangements/food allowance will be provided as per the applicable project terms.</p><ul style={{ margin: 0, paddingLeft: 20 }}><li style={itemStyle}>Maximum Food Allowance: Up to {value('foodAllowance', '₹400 per day')}, subject to the meals provided.</li><li style={itemStyle}>Where breakfast and lunch are provided at the workplace, the applicable food allowance will be {value('dinnerAllowance', '₹100 per day')} towards dinner.</li><li style={itemStyle}>The actual food allowance will depend on the meals provided at the assigned project location.</li><li style={itemStyle}>Food allowance will be paid once every 15 days, subject to eligibility and applicable project guidelines.</li></ul></div>
      <div style={sectionStyle}><div style={headingStyle}>6. Daily Stipend</div><p style={{ margin: '0 0 6px' }}>The candidate will be eligible for:</p><ul style={{ margin: 0, paddingLeft: 20 }}><li style={itemStyle}><strong>Daily Stipend:</strong> {value('dailyStipend', '₹600 per day')}</li><li style={itemStyle}><strong>Food Allowance:</strong> Up to {value('foodAllowance', '₹400 per day')}, as applicable.</li></ul><p style={{ margin: '8px 0 0' }}>Payment will be subject to attendance, actual days of engagement, project requirements, and applicable company policies.</p></div>
      <div style={sectionStyle}><div style={headingStyle}>7. Travel During the Project</div><p style={{ margin: 0 }}>Travel required for official project activities will be arranged by the company or reimbursed as per the applicable project guidelines. Personal travel or travel undertaken without prior approval will not be eligible for reimbursement.</p></div>
    </>
  ) : (
    <>
      <div style={sectionStyle}><div style={headingStyle}>8. Candidate Responsibilities</div><p style={{ margin: '0 0 6px' }}>As this is a short-term project assignment, the candidate is required to:</p><ul style={{ margin: 0, paddingLeft: 20 }}>{['Report to the training location on the training reporting date as instructed.', 'Attend and successfully complete the mandatory 4-day training.', `Be willing to work at any one of the 15 districts in ${value('projectLocation', 'Uttar Pradesh')}.`, `Stay in ${value('projectLocation', 'Uttar Pradesh')} for the complete project duration.`, 'Follow the assigned work timings and reporting instructions.', 'Maintain regular attendance throughout the project.', 'Follow all company, client, project, safety, and operational guidelines.', 'Submit required documents, travel tickets, and proofs for reimbursement wherever applicable.', 'Remain available for the complete project duration up to the project end date.', 'Comply with any reasonable instructions issued by the company/project team.'].map((item) => <li key={item} style={itemStyle}>{item}</li>)}</ul></div>
      <div style={sectionStyle}><div style={headingStyle}>9. Nature and Duration of Assignment</div><p style={{ margin: '0 0 8px' }}>This offer is specifically for a short-term project assignment and is limited to the project duration mentioned above.</p><p style={{ margin: 0 }}>The assignment does not constitute a permanent employment commitment. Any extension beyond the stated project duration will be subject to project requirements and separate communication from the company.</p></div>
      <div style={sectionStyle}><div style={headingStyle}>10. Acceptance of Offer</div><p style={{ margin: '0 0 8px' }}>By accepting this offer, you confirm that you have read, understood, and agreed to the above terms and conditions, including the requirement to travel to {value('trainingLocation', 'Lucknow')}, undergo training, stay in {value('projectLocation', 'Uttar Pradesh')}, and work at any assigned district during the project period.</p><p style={{ margin: 0 }}>Please sign and return a copy of this offer letter as confirmation of your acceptance.</p></div>
      <p style={{ margin: '0 0 20px' }}>We welcome you to the project and wish you a successful assignment.</p>
      <div style={{ marginBottom: 22 }}><strong>For {value('companyName', 'Cynosure Corporate Solutions')}</strong><br /><br />Authorized Signatory<br />Name: {personNameValue('authorizedSignatoryName')}<br />Designation: {value('authorizedSignatoryDesignation')}<br />Date: {dateValue('authorizedSignatoryDate')}</div>
      <div style={{ borderTop: '1px solid #000', paddingTop: 12 }}><div style={headingStyle}>CANDIDATE ACCEPTANCE</div><p style={{ margin: '0 0 12px' }}>I, {candidateName}, hereby confirm that I have read and understood the terms and conditions mentioned in this Offer Letter and willingly accept the short-term project assignment in {value('projectLocation', 'Uttar Pradesh')}.</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}> <div>Candidate Name: {candidateName}</div><div>Signature: __________________</div><div>Date: __________________</div></div></div>
    </>
  )

  return <div data-offer-letter-page-root style={{ width: '794px', height: '1123px', padding: '42px 52px', boxSizing: 'border-box', overflow: 'hidden', background: '#fff', color: '#000', fontFamily: 'Arial, sans-serif', fontSize: '10.5pt', lineHeight: 1.35, position: 'relative' }}><div style={{ minHeight: 'calc(100% - 24px)' }}>{pageNumber > 1 && <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: 8, marginBottom: 16 }}><img src={`${import.meta.env.BASE_URL}cyno-logo.png`} alt="Cynosure Corporate Solutions" width="220" height="110" style={{ width: 220, height: 110, maxWidth: '100%', objectFit: 'contain' }} /></div>}{pageContent}</div><div style={{ position: 'absolute', bottom: 24, left: 52, right: 52, textAlign: 'center', fontSize: '7pt', color: '#555' }}>Door No 5, 42, 2nd St, Navarathna Garden, Ekkatuthangal, Chennai, Tamil Nadu 600032</div></div>
}

const OfferLetterEditor = ({ candidate = {}, offerData = {}, editable = false, onChange = () => {} }) => (
  <div style={{ background: '#eef2f4', padding: '18px', overflow: 'auto' }}>
    <div style={{ maxWidth: 794, margin: '0 auto 18px', color: 'var(--text2)', fontSize: 13 }}>
      {editable ? 'Edit the highlighted fields directly in the letter. Candidate name and address are populated from the selected candidate.' : 'Review the completed offer letter. Candidate name and address are populated from the selected candidate.'}
    </div>
    {[1, 2, 3].map((pageNumber) => (
      <div key={pageNumber} style={{ width: '794px', maxWidth: '100%', margin: '0 auto 18px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.14)' }}>
        <OfferLetterPageLayout candidate={candidate} offerData={offerData} pageNumber={pageNumber} editable={editable} onChange={onChange} />
      </div>
    ))}
  </div>
)

export const generateOfferLetterPDF = async (candidateId, offerData = {}, rowData = null) => {
  try {
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📄', message: `Start Offer Letter PDF: ${candidateId}`, duration: 0 } }))
    const candidateResult = await recruiterAPI.getCandidateById(candidateId, { silent: true })
    const apiCandidate = normalizePoliceCandidateResponse(candidateResult) || {}
    const candidate = { ...apiCandidate, name: apiCandidate.name || rowData?.name || '', district: rowData?.district || rowData?.district_name || apiCandidate.district || '', presentAddress: apiCandidate.presentAddress || rowData?.address || rowData?.location || '', permanentAddress: apiCandidate.permanentAddress || rowData?.permanentAddress || '', location: apiCandidate.location || rowData?.location || '' }
    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.backgroundColor = '#fff'
    document.body.appendChild(tempContainer)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
      const pageContainer = document.createElement('div')
      tempContainer.appendChild(pageContainer)
      const pageRoot = ReactDOM.createRoot(pageContainer)
      pageRoot.render(<OfferLetterPageLayout candidate={candidate} offerData={offerData} pageNumber={pageIndex + 1} totalPages={3} />)
      let pageElement = pageContainer.querySelector('[data-offer-letter-page-root]')
      let waited = 0
      while (!pageElement && waited < 15000) {
        await new Promise((resolve) => setTimeout(resolve, 100))
        waited += 100
        pageElement = pageContainer.querySelector('[data-offer-letter-page-root]')
      }
      if (!pageElement) throw new Error(`Failed to render offer letter page ${pageIndex + 1}`)
      await Promise.all(Array.from(pageElement.querySelectorAll('img')).map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => { image.onload = resolve; image.onerror = resolve })))
      const canvas = await html2canvas(pageElement, { scale: HTML2CANVAS_SCALE, backgroundColor: '#fff', logging: false, width: 794, height: 1123, windowWidth: 794, windowHeight: 1123 })
      if (pageIndex > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.8), PDF_IMAGE_FORMAT, 0, 0, pdfWidth, pdfHeight)
      pageRoot.unmount()
      pageContainer.remove()
    }
    tempContainer.remove()
    return { blob: pdf.output('blob') }
  } catch (err) {
    console.error('generateOfferLetterPDF error:', err)
    return { error: err?.message || 'offer_letter_generation_failed' }
  }
}

export const generateAgreementPDF = async (candidateId, agreementData = {}, rowData = null) => {
  try {
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📄', message: `Start Agreement PDF: ${candidateId}`, duration: 0 } }))
    const [candidateResult, ocrResult] = await Promise.allSettled([
      recruiterAPI.getCandidateById(candidateId, { silent: true }),
      recruiterAPI.getAadhaarOcrVerification(candidateId, { silent: true }),
    ])

    if (candidateResult.status !== 'fulfilled') {
      console.warn('Failed to fetch candidate for Agreement:', candidateResult.reason)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Failed to fetch candidate ${candidateId}`, duration: 3000 } }))
      return { error: 'failed_to_fetch_candidate' }
    }

    const apiCandidate = normalizePoliceCandidateResponse(candidateResult.value) || {}

    let ocrData = null
    if (ocrResult.status === 'fulfilled') {
      try {
        ocrData = normalizePoliceOcrResponse(ocrResult.value)
      } catch (e) {
        console.warn('Failed to normalize OCR response for Agreement:', e)
        ocrData = null
      }
    } else {
      console.warn('Aadhaar OCR fetch failed for Agreement; proceeding without OCR data:', ocrResult.reason)
      ocrData = null
    }

    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: 'ℹ️', message: `Fetched candidate ${candidateId}`, duration: 0 } }))

    const candidate = {
      ...apiCandidate,
      name: apiCandidate.name || rowData?.name || rowData?.candidatename || rowData?.candidate_name || rowData?.candidateName || '',
      mobile: apiCandidate.mobile || rowData?.mobile || rowData?.mobileno || rowData?.mobile_number || rowData?.candidate_mobile_number || '',
      fatherName: apiCandidate.fatherName || rowData?.fatherName || rowData?.father_name || rowData?.care_of || '',
      aadhaarNumber: apiCandidate.aadhaarNumber || rowData?.aadhaar || rowData?.aadhar || rowData?.aadhaar_number || rowData?.masked_aadhaar || '',
      presentAddress: apiCandidate.presentAddress || rowData?.presentAddress || rowData?.present_address || rowData?.current_address || rowData?.currentAddress || rowData?.address || rowData?.address1 || rowData?.address_line1 || '',
      permanentAddress: apiCandidate.permanentAddress || rowData?.permanentAddress || rowData?.permanent_address || rowData?.address2 || rowData?.address_line2 || '',
      profileImage: apiCandidate.profileImage || rowData?.profileImage || rowData?.profile_image || rowData?.photo || rowData?.image || null,
      aadhaarFront: apiCandidate.aadhaarFront || rowData?.aadhaarFront || rowData?.aadhaar_front || rowData?.aadharFront || rowData?.aadhaar_front_url || null,
      aadhaarBack: apiCandidate.aadhaarBack || rowData?.aadhaarBack || rowData?.aadhaar_back || rowData?.aadharBack || rowData?.aadhaar_back_url || null,
      district: apiCandidate.district || rowData?.district || rowData?.district_name || '',
      centre: apiCandidate.centre || rowData?.centre || rowData?.center || rowData?.centre_name || rowData?.center_name || '',
      centreCode: apiCandidate.centreCode || rowData?.centreCode || rowData?.centre_code || rowData?.centerid || rowData?.centre_id || rowData?.centerId || '',
      designation: apiCandidate.designation || rowData?.designation || rowData?.Designation || rowData?.designation_name || apiCandidate.role || rowData?.role || '',
      panNumber: apiCandidate.panNumber || rowData?.panNumber || rowData?.pan || rowData?.pan_no || rowData?.pan_number || rowData?.PAN || rowData?.PAN_NO || rowData?.PAN_NUMBER || '',
    }

    try {
      if (candidate?.aadhaarFront) {
        const frontUrl = await getDisplayableImageUrl(candidate.aadhaarFront)
        if (frontUrl) candidate.aadhaarFront = frontUrl
      }
      if (candidate?.aadhaarBack) {
        const backUrl = await getDisplayableImageUrl(candidate.aadhaarBack)
        if (backUrl) candidate.aadhaarBack = backUrl
      }
      if (candidate?.profileImage) {
        const profileUrl = await getDisplayableImageUrl(candidate.profileImage)
        if (profileUrl) candidate.profileImage = profileUrl
      }
    } catch (imgErr) {
      console.warn('Image conversion error for Agreement report; proceeding with original URLs', imgErr)
    }

    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.padding = '0px'
    tempContainer.style.borderRadius = '0px'
    tempContainer.innerHTML = '<div id="agreement-report-export-container"></div>'
    document.body.appendChild(tempContainer)

    const exportContainer = tempContainer.querySelector('#agreement-report-export-container')
    const measureRoot = ReactDOM.createRoot(exportContainer)
    measureRoot.render(<AgreementPageLayout candidate={candidate} ocrData={ocrData} agreementData={{
      ...agreementData,
      panNumber: agreementData.panNumber || candidate.panNumber || candidate.pan || '',
      designation: agreementData.designation || candidate.designation || candidate.role || ''
    }} pageNumber={1} totalPages={2} offsetY={0} />)

    const waitTimeout = 30000
    const pollInterval = 200
    let waited = 0
    let exportRoot = exportContainer.querySelector('[data-agreement-page-root]')
    while (!exportRoot && waited < waitTimeout) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, pollInterval))
      waited += pollInterval
      exportRoot = exportContainer.querySelector('[data-agreement-page-root]')
    }

    if (!exportRoot) {
      try { measureRoot.unmount() } catch (e) {}
      document.body.removeChild(tempContainer)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Skipped candidate ${candidateId} - failed to load Agreement details`, duration: 2000 }
      }))
      return { error: 'failed_to_load_agreement_details' }
    }

    const totalPages = 3

    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '🖨️', message: `Rendered agreement DOM for ${candidateId}`, duration: 0 } }))

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      const pageContainer = document.createElement('div')
      pageContainer.style.position = 'fixed'
      pageContainer.style.left = '-9999px'
      pageContainer.style.top = '-9999px'
      pageContainer.style.width = '794px'
      pageContainer.style.backgroundColor = '#ffffff'
      pageContainer.style.padding = '0px'
      pageContainer.style.borderRadius = '0px'
      pageContainer.innerHTML = '<div id="agreement-report-page-container"></div>'
      tempContainer.appendChild(pageContainer)

      const pageRenderContainer = pageContainer.querySelector('#agreement-report-page-container')
      const pageRoot = ReactDOM.createRoot(pageRenderContainer)
      pageRoot.render(
        <AgreementPageLayout
          candidate={candidate}
          ocrData={ocrData}
          agreementData={{
            ...agreementData,
            panNumber: agreementData.panNumber || candidate.panNumber || candidate.pan || '',
            designation: agreementData.designation || candidate.designation || candidate.role || ''
          }}
          pageNumber={pageIndex + 1}
          totalPages={totalPages}
          offsetY={0}
        />
      )

      // Wait for page element to render
      let pageElement = pageRenderContainer.querySelector('[data-agreement-page-root]')
      let pageWaited = 0
      const pageWaitTimeout = 15000
      const pageWaitInterval = 200
      while (!pageElement && pageWaited < pageWaitTimeout) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, pageWaitInterval))
        pageWaited += pageWaitInterval
        pageElement = pageRenderContainer.querySelector('[data-agreement-page-root]')
      }

      if (!pageElement) {
        try { pageRoot.unmount() } catch (e) {}
        try { pageContainer.remove() } catch (e) {}
        window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Skipped page ${pageIndex + 1} for ${candidateId} - failed to load page`, duration: 2000 } }))
        continue
      }

      const images = pageElement.querySelectorAll('img')
      await Promise.all(Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
        })
      }))

      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '⏳', message: `Rendering canvas ${pageIndex + 1}/${totalPages} for ${candidateId}`, duration: 0 } }))
      const canvas = await html2canvas(pageElement, {
        scale: HTML2CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: pageElement.scrollWidth,
        height: pageElement.scrollHeight,
        windowWidth: pageElement.scrollWidth,
        windowHeight: pageElement.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.8)
      if (pageIndex > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, 0, pdfWidth, pdfHeight)

      try { pageRoot.unmount() } catch (e) {}
      try { pageContainer.remove() } catch (e) {}
    }

    try { measureRoot.unmount() } catch (e) {}
    document.body.removeChild(tempContainer)

    const pdfBlob = pdf.output('blob')
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '✅', message: `Agreement PDF created for ${candidateId}`, duration: 0 } }))
    return { blob: pdfBlob }
  } catch (err) {
    console.error('generateAgreementPDF error:', err)
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: `Error generating Agreement for ${candidateId}: ${err?.message || 'generate_error'}`, duration: 4000 } }))
    return { error: err?.message || 'generate_error' }
  }
}

export const generateAgreementWithPolicePDF = async (candidateId, agreementData = {}, rowData = null) => {
  try {
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📄', message: `Start Agreement with Police PDF: ${candidateId}`, duration: 0 } }))
    const [candidateResult, ocrResult] = await Promise.allSettled([
      recruiterAPI.getCandidateById(candidateId, { silent: true }),
      recruiterAPI.getAadhaarOcrVerification(candidateId, { silent: true }),
    ])

    if (candidateResult.status !== 'fulfilled') {
      console.warn('Failed to fetch candidate for Agreement+Police:', candidateResult.reason)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Failed to fetch candidate ${candidateId}`, duration: 3000 } }))
      return { error: 'failed_to_fetch_candidate' }
    }

    const apiCandidate = normalizePoliceCandidateResponse(candidateResult.value) || {}

    let ocrData = null
    if (ocrResult.status === 'fulfilled') {
      try {
        ocrData = normalizePoliceOcrResponse(ocrResult.value)
      } catch (e) {
        console.warn('Failed to normalize OCR response for Agreement+Police:', e)
        ocrData = null
      }
    } else {
      console.warn('Aadhaar OCR fetch failed for Agreement+Police; proceeding without OCR data:', ocrResult.reason)
      ocrData = null
    }

    // Resolve nearest police station info
    const policeStationInfo = resolveBiharNearestPoliceStation(apiCandidate, ocrData)

    const candidate = {
      ...apiCandidate,
      ...policeStationInfo,
      name: apiCandidate.name || rowData?.name || rowData?.candidatename || rowData?.candidate_name || rowData?.candidateName || '',
      mobile: apiCandidate.mobile || rowData?.mobile || rowData?.mobileno || rowData?.mobile_number || rowData?.candidate_mobile_number || '',
      fatherName: apiCandidate.fatherName || rowData?.fatherName || rowData?.father_name || rowData?.care_of || '',
      aadhaarNumber: apiCandidate.aadhaarNumber || rowData?.aadhaar || rowData?.aadhar || rowData?.aadhaar_number || rowData?.masked_aadhaar || '',
      presentAddress: apiCandidate.presentAddress || rowData?.presentAddress || rowData?.present_address || rowData?.current_address || rowData?.currentAddress || rowData?.address || rowData?.address1 || rowData?.address_line1 || '',
      permanentAddress: apiCandidate.permanentAddress || rowData?.permanentAddress || rowData?.permanent_address || rowData?.address2 || rowData?.address_line2 || '',
      profileImage: apiCandidate.profileImage || rowData?.profileImage || rowData?.profile_image || rowData?.photo || rowData?.image || null,
      aadhaarFront: apiCandidate.aadhaarFront || rowData?.aadhaarFront || rowData?.aadhaar_front || rowData?.aadharFront || rowData?.aadhaar_front_url || null,
      aadhaarBack: apiCandidate.aadhaarBack || rowData?.aadhaarBack || rowData?.aadhaar_back || rowData?.aadharBack || rowData?.aadhaar_back_url || null,
      district: apiCandidate.district || rowData?.district || rowData?.district_name || '',
      centre: apiCandidate.centre || rowData?.centre || rowData?.center || rowData?.centre_name || rowData?.center_name || '',
      centreCode: apiCandidate.centreCode || rowData?.centreCode || rowData?.centre_code || rowData?.centerid || rowData?.centre_id || rowData?.centerId || '',
      designation: apiCandidate.designation || rowData?.designation || rowData?.Designation || rowData?.designation_name || apiCandidate.role || rowData?.role || '',
      panNumber: apiCandidate.panNumber || rowData?.panNumber || rowData?.pan || rowData?.pan_no || rowData?.pan_number || rowData?.PAN || rowData?.PAN_NO || rowData?.PAN_NUMBER || '',
    }

    try {
      if (candidate?.aadhaarFront) {
        const frontUrl = await getDisplayableImageUrl(candidate.aadhaarFront)
        if (frontUrl) candidate.aadhaarFront = frontUrl
      }
      if (candidate?.aadhaarBack) {
        const backUrl = await getDisplayableImageUrl(candidate.aadhaarBack)
        if (backUrl) candidate.aadhaarBack = backUrl
      }
      if (candidate?.profileImage) {
        const profileUrl = await getDisplayableImageUrl(candidate.profileImage)
        if (profileUrl) candidate.profileImage = profileUrl
      }
    } catch (imgErr) {
      console.warn('Image conversion error for Agreement+Police report; proceeding with original URLs', imgErr)
    }

    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '-9999px'
    tempContainer.style.top = '-9999px'
    tempContainer.style.width = '794px'
    tempContainer.style.minHeight = '1123px'
    tempContainer.style.backgroundColor = '#ffffff'
    tempContainer.style.padding = '0px'
    tempContainer.style.borderRadius = '0px'
    tempContainer.innerHTML = '<div id="agreement-report-export-container"></div>'
    document.body.appendChild(tempContainer)

    const exportContainer = tempContainer.querySelector('#agreement-report-export-container')
    const measureRoot = ReactDOM.createRoot(exportContainer)
    measureRoot.render(<AgreementPageLayout candidate={candidate} ocrData={ocrData} agreementData={{
      ...agreementData,
      panNumber: agreementData.panNumber || candidate.panNumber || candidate.pan || '',
      designation: agreementData.designation || candidate.designation || candidate.role || ''
    }} pageNumber={1} totalPages={4} offsetY={0} />)

    const waitTimeout = 30000
    const pollInterval = 200
    let waited = 0
    let exportRoot = exportContainer.querySelector('[data-agreement-page-root]')
    while (!exportRoot && waited < waitTimeout) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, pollInterval))
      waited += pollInterval
      exportRoot = exportContainer.querySelector('[data-agreement-page-root]')
    }

    if (!exportRoot) {
      try { measureRoot.unmount() } catch (e) {}
      document.body.removeChild(tempContainer)
      window.dispatchEvent(new CustomEvent('apiMessage', {
        detail: { type: 'warning', icon: '⚠️', message: `Skipped candidate ${candidateId} - failed to load Agreement+Police details`, duration: 2000 }
      }))
      return { error: 'failed_to_load_agreement_details' }
    }

    const totalPages = 4

    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '🖨️', message: `Rendered agreement+police DOM for ${candidateId}`, duration: 0 } }))

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      const pageContainer = document.createElement('div')
      pageContainer.style.position = 'fixed'
      pageContainer.style.left = '-9999px'
      pageContainer.style.top = '-9999px'
      pageContainer.style.width = '794px'
      pageContainer.style.backgroundColor = '#ffffff'
      pageContainer.style.padding = '0px'
      pageContainer.style.borderRadius = '0px'
      pageContainer.innerHTML = '<div id="agreement-report-page-container"></div>'
      tempContainer.appendChild(pageContainer)

      const pageRenderContainer = pageContainer.querySelector('#agreement-report-page-container')
      const pageRoot = ReactDOM.createRoot(pageRenderContainer)
      pageRoot.render(
        <AgreementPageLayout
          candidate={candidate}
          ocrData={ocrData}
          agreementData={{
            ...agreementData,
            panNumber: agreementData.panNumber || candidate.panNumber || candidate.pan || '',
            designation: agreementData.designation || candidate.designation || candidate.role || ''
          }}
          pageNumber={pageIndex + 1}
          totalPages={totalPages}
          offsetY={0}
        />
      )

      // Wait for page element to render
      let pageElement = pageRenderContainer.querySelector('[data-agreement-page-root]')
      let pageWaited = 0
      const pageWaitTimeout = 15000
      const pageWaitInterval = 200
      while (!pageElement && pageWaited < pageWaitTimeout) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((res) => setTimeout(res, pageWaitInterval))
        pageWaited += pageWaitInterval
        pageElement = pageRenderContainer.querySelector('[data-agreement-page-root]')
      }

      if (!pageElement) {
        try { pageRoot.unmount() } catch (e) {}
        try { pageContainer.remove() } catch (e) {}
        window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Skipped page ${pageIndex + 1} for ${candidateId} - failed to load page`, duration: 2000 } }))
        continue
      }

      const images = pageElement.querySelectorAll('img')
      await Promise.all(Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve()
        return new Promise((resolve) => {
          img.onload = resolve
          img.onerror = resolve
        })
      }))

      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '⏳', message: `Rendering canvas ${pageIndex + 1}/${totalPages} for ${candidateId}`, duration: 0 } }))
      const canvas = await html2canvas(pageElement, {
        scale: HTML2CANVAS_SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: pageElement.scrollWidth,
        height: pageElement.scrollHeight,
        windowWidth: pageElement.scrollWidth,
        windowHeight: pageElement.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.8)
      if (pageIndex > 0) {
        pdf.addPage()
      }
      pdf.addImage(imgData, PDF_IMAGE_FORMAT, 0, 0, pdfWidth, pdfHeight)

      try { pageRoot.unmount() } catch (e) {}
      try { pageContainer.remove() } catch (e) {}
    }

    try { measureRoot.unmount() } catch (e) {}
    document.body.removeChild(tempContainer)

    const pdfBlob = pdf.output('blob')
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '✅', message: `Agreement+Police PDF created for ${candidateId}`, duration: 0 } }))
    return { blob: pdfBlob }
  } catch (err) {
    console.error('generateAgreementWithPolicePDF error:', err)
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: `Error generating Agreement+Police for ${candidateId}: ${err?.message || 'generate_error'}`, duration: 4000 } }))
    return { error: err?.message || 'generate_error' }
  }
}

// Bulk export handler: supports PDF reports and image modes
const bulkExportAsZip = async (selectedRowIds = [], results = [], rawApiData = [], onCancel = { isCancelled: false }, exportStructure = 'hierarchical', exportMode = 'report', agreementData = {}) => {
  try {
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📤', message: `Export started: mode=${exportMode}, items=${selectedRowIds.length}`, duration: 0 } }))
    if (!selectedRowIds || selectedRowIds.length === 0) {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: 'ℹ️', message: 'No candidates selected for export', duration: 3000 } }))
      return { success: false, failedIds: [], processedCount: 0, failedCount: 0 }
    }

    const zip = new JSZip()
    const candidatesFolder = zip.folder('candidate_reports')

    // Preserve duplicates (rows) but omit rows whose candidate status is 'not_registered'.
    const validRowIds = []
    const omittedDetails = []
    selectedRowIds.forEach(rowId => {
      const row = results.find(r => String(r.id) === String(rowId))
      if (!row) {
        omittedDetails.push({ rowId, reason: 'not_found_in_results' })
      } else if (getStatusCategory(row.status) === 'not_registered') {
        omittedDetails.push({ rowId, candidateId: row.candidateId, reason: 'excluded_not_registered' })
      } else {
        validRowIds.push(rowId)
      }
    })

    const usesLocation = validRowIds.some(rowId => {
      const row = results.find(r => String(r.id) === String(rowId))
      return row && row.location && String(row.location).trim().length > 0
    })

    const totalCount = validRowIds.length
    let processedCount = 0
    let failedCount = 0
    const failedIds = []
    const failedDetails = []
    let profileImageExportItems = []

    const CONCURRENCY_LIMIT = exportMode === 'report' || exportMode === 'police_report' || exportMode === 'kyc_report' || exportMode === 'agreement' || exportMode === 'agreement_with_police' || exportMode === 'offer_letter' ? PDF_CONCURRENCY : IMAGE_CONCURRENCY
    let lastProgressUpdate = 0

    // Processor for report (PDF)
    if (exportMode === 'report' || exportMode === 'police_report' || exportMode === 'kyc_report' || exportMode === 'agreement' || exportMode === 'agreement_with_police' || exportMode === 'offer_letter') {
      const progressLabel = exportMode === 'police_report'
        ? 'Generating Police Report PDFs...'
        : exportMode === 'kyc_report'
          ? 'Generating KYC Report PDFs...'
          : exportMode === 'agreement'
            ? 'Generating Agreement PDFs...'
              : exportMode === 'agreement_with_police'
              ? 'Generating Agreement with Police Report PDFs...'
                : exportMode === 'offer_letter'
                  ? 'Generating Offer Letter PDFs...'
                  : 'Generating PDF reports...'
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: progressLabel, duration: 0 } }))

      await processConcurrently(validRowIds, async (rowId) => {
        window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '➡️', message: `Processing candidate ${rowId}`, duration: 0 } }))
        if (onCancel?.isCancelled) throw new Error('Export cancelled')
        const row = results.find(r => String(r.id) === String(rowId))
        const candidateId = row?.candidateId
        // Attempt to enrich row/agreement data using the uploaded Excel `row` first, then fall back to checkKYCStatus API
        let enrichedAgreementData = { ...agreementData }
        // Prefer values from the row (uploaded Excel)
        enrichedAgreementData.venueName = enrichedAgreementData.venueName || row?.centre || row?.centre_name || row?.center || row?.center_name || row?.venue || row?.venue_name || enrichedAgreementData.venueName
        enrichedAgreementData.centreCode = enrichedAgreementData.centreCode || row?.centreCode || row?.centre_code || row?.centerid || row?.centre_id || row?.centerId || row?.centre || enrichedAgreementData.centreCode
        enrichedAgreementData.designation = enrichedAgreementData.designation || row?.designation || row?.Designation || row?.designation_name || row?.role || enrichedAgreementData.designation
        // If some values are still missing, try the API as a fallback
        if (!enrichedAgreementData.venueName || !enrichedAgreementData.centreCode || !enrichedAgreementData.designation || !enrichedAgreementData.recruitmentInfo) {
          try {
            const statusResp = await recruiterAPI.checkKYCStatus({ candidate_id: candidateId })
            const statusData = statusResp?.data || {}
            enrichedAgreementData.venueName = enrichedAgreementData.venueName || statusData?.centre_name || statusData?.venue_name || statusData?.venue || enrichedAgreementData.venueName
            enrichedAgreementData.centreCode = enrichedAgreementData.centreCode || statusData?.centre_code || statusData?.centerid || statusData?.centre || enrichedAgreementData.centreCode
            enrichedAgreementData.recruitmentInfo = enrichedAgreementData.recruitmentInfo || statusData?.organisation || statusData?.organisation_name || statusData?.organization || enrichedAgreementData.recruitmentInfo
            enrichedAgreementData.designation = enrichedAgreementData.designation || statusData?.designation || statusData?.designation_name || statusData?.role || enrichedAgreementData.designation
          } catch (e) {
            // ignore enrichment errors; fallback to provided agreementData
          }
        }

        const pdfData = exportMode === 'police_report'
          ? await generatePoliceReportPDF(candidateId)
          : exportMode === 'kyc_report'
            ? await generateKycReportPDF(candidateId, row)
            : exportMode === 'agreement'
              ? await generateAgreementPDF(candidateId, enrichedAgreementData, row)
              : exportMode === 'agreement_with_police'
                ? await generateAgreementWithPolicePDF(candidateId, enrichedAgreementData, row)
                : exportMode === 'offer_letter'
                  ? await generateOfferLetterPDF(candidateId, agreementData, row)
                  : await generateCandidatePDF(candidateId)
        processedCount++
        if (!pdfData || pdfData.error) {
          failedCount++
          failedIds.push(candidateId || rowId)
          failedDetails.push({ rowId, candidateId, reason: pdfData?.error || 'pdf_generation_failed' })
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Failed PDF for ${candidateId || rowId}: ${pdfData?.error || 'unknown'}`, duration: 3000 } }))
        } else {
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '✅', message: `Generated PDF for ${candidateId || rowId}`, duration: 1500 } }))
          const candidate = row
          let folderPath = ''
          if (exportStructure === 'flat') {
            folderPath = ''
          } else {
            if (usesLocation) {
              folderPath = sanitizeFileName(candidate.location || 'Unknown Location')
            } else {
              const district = sanitizeFileName(candidate.district || 'Unknown District')
              const centreCode = candidate.centreCode || candidate.centre_code || candidate.centerid || sanitizeFileName(candidate.centre || 'Unknown Centre')
              folderPath = `${district}/${sanitizeFileName(centreCode)}`
            }
          }
          const fileName = getFormattedFileName(candidate)
          if (folderPath) candidatesFolder.folder(folderPath).file(fileName, pdfData.blob)
          else candidatesFolder.file(fileName, pdfData.blob)
        }
        // Throttle progress updates to every 2 items or final update
        const now = Date.now()
        if (now - lastProgressUpdate > 500 || processedCount === totalCount) {
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: `Generating PDFs: ${processedCount} of ${totalCount}`, duration: 0 } }))
          lastProgressUpdate = now
        }
        return true
      }, CONCURRENCY_LIMIT, onCancel)
    } else {
      // Image export modes: each candidate gets their own folder
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: 'Downloading image assets...', duration: 0 } }))

      await processConcurrently(validRowIds, async (rowId) => {
        if (onCancel?.isCancelled) throw new Error('Export cancelled')
        const row = results.find(r => String(r.id) === String(rowId)) || {}
        const candidateId = row.candidateId
        
        // First try to find raw API data for this candidate
        let rawCandidate = rawApiData.find(r => String(r.id || r.candidate_id || r.candidateId) === String(candidateId))
        
        let imageUrls = getImageUrlsFromCandidate(rawCandidate, exportMode)

        // Attempt to fetch fresh candidate data if any URL missing
        const hasAny = Object.values(imageUrls).some(url => !!url)
        if (!hasAny && candidateId) {
          try {
            const resp = await recruiterAPI.getCandidateById(candidateId)
            const fresh = resp?.data?.data || resp?.data || {}
            imageUrls = getImageUrlsFromCandidate(fresh, exportMode)
          } catch (err) {
            console.warn(`Failed to fetch fresh candidate data for ${candidateId}:`, err.message)
          }
        }

        // Check if we have at least one image
        const hasImages = Object.values(imageUrls).some(url => !!url)
        if (!hasImages) {
          console.warn(`No image URLs found for candidate ${candidateId || rowId} in ${exportMode} mode`)
          failedCount++
          failedIds.push(candidateId || rowId)
          processedCount++
          const now = Date.now()
          if (now - lastProgressUpdate > 500 || processedCount === totalCount) {
            window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: `Downloaded ${processedCount} of ${totalCount}`, duration: 0 } }))
            lastProgressUpdate = now
          }
          return null
        }

        try {
          const isSingleImageMode = ['profile', 'aadhaar_front', 'aadhaar_back'].includes(exportMode)
          const candidateName = `${sanitizeFileName(row.name || String(candidateId || rowId))}_${sanitizeFileName(row.mobile || '')}_${sanitizeFileName(row.aadhaar || '')}`
          
          // Build hierarchical path if requested
          let baseFolder = candidatesFolder
          if (exportStructure !== 'flat') {
            if (usesLocation) {
              const loc = sanitizeFileName(row.location || 'Unknown Location')
              baseFolder = candidatesFolder.folder(loc)
            } else {
              const district = sanitizeFileName(row.district || 'Unknown District')
              const centreCode = row.centreCode || row.centre_code || row.centerid || sanitizeFileName(row.centre || 'Unknown Centre')
              baseFolder = candidatesFolder.folder(`${district}/${sanitizeFileName(centreCode)}`)
            }
          }
          
          // For single-image modes, don't create per-candidate folder; name the file directly
          const targetFolder = isSingleImageMode ? baseFolder : baseFolder.folder(candidateName)
          
          let downloadedAny = false
          // Download each available image
          for (const [imageType, imageUrl] of Object.entries(imageUrls)) {
            if (!imageUrl) continue
            try {
              const blob = await fetchWithRetries(imageUrl, {}, 2, onCancel)
              if (!blob) {
                console.warn(`Failed to download ${imageType} for candidate ${candidateId || rowId}`)
                continue
              }
              let ext = 'jpg'
              if (blob.type && blob.type.includes('/')) ext = blob.type.split('/').pop().split(';')[0] || ext
              const fileName = isSingleImageMode ? `${candidateName}.${ext}` : `${imageType}.${ext}`
              targetFolder.file(fileName, blob)
              downloadedAny = true
              if (isSingleImageMode && exportMode === 'profile') {
                profileImageExportItems.push({ row, fileName })
              }
            } catch (err) {
              console.warn(`Error downloading ${imageType} for candidate ${candidateId || rowId}:`, err.message)
            }
          }
          
              if (!downloadedAny) {
            failedCount++
            failedIds.push(candidateId || rowId)
            failedDetails.push({ rowId, candidateId, reason: 'no_images_downloaded' })
            processedCount++
            return null
          }
          processedCount++
        } catch (err) {
          console.warn(`Failed to export images for candidate ${candidateId || rowId}:`, err.message)
          failedCount++
          failedIds.push(candidateId || rowId)
          failedDetails.push({ rowId, candidateId, reason: err?.message || 'image_export_failed' })
          processedCount++
        }

        const now = Date.now()
        if (now - lastProgressUpdate > 500 || processedCount === totalCount) {
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: `Downloaded ${processedCount} of ${totalCount}`, duration: 0 } }))
          lastProgressUpdate = now
        }
        return true
      }, CONCURRENCY_LIMIT, onCancel)
    }

    if (onCancel?.isCancelled) {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: 'Export cancelled by user', duration: 3000 } }))
      return { success: false, failedIds: [], failedDetails: [], processedCount: processedCount, failedCount, cancelled: true }
    }

    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: '📥', message: 'Building ZIP file...', duration: 0 } }))
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    const timestamp = new Date().toISOString().split('T')[0]
    const suffix = exportMode === 'report'
      ? 'reports'
      : exportMode === 'police_report'
        ? 'police_reports'
        : exportMode === 'kyc_report'
          ? 'kyc_reports'
          : exportMode === 'agreement'
            ? 'agreements'
            : exportMode === 'offer_letter'
              ? 'offer_letters'
            : exportMode
    saveAs(zipBlob, `candidate_${suffix}_${timestamp}.zip`)

    if (failedIds.length > 0) console.warn(`Export completed with ${failedCount} failures. Failed candidate IDs:`, failedIds, failedDetails)

    const message = failedCount > 0 ? `Exported ${totalCount - failedCount} items. ${failedCount} failed.` : `Export successful: ${totalCount} items.`
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: failedCount > 0 ? 'warning' : 'success', icon: failedCount > 0 ? '⚠️' : '✅', message, duration: 3000 } }))

    return { success: true, failedIds, failedDetails, omittedDetails, processedCount: totalCount, failedCount, cancelled: false, profileImageExportItems }
  } catch (err) {
    if (err.message === 'Export cancelled') return { success: false, failedIds: [], processedCount: 0, failedCount: 0, cancelled: true }
    console.error('bulkExportAsZip error:', err)
    window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: 'Failed to export. Please try again.', duration: 3000 } }))
    return { success: false, failedIds: [], processedCount: 0, failedCount: 0 }
  }
}

export default function CheckKYC() {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [results, setResults] = useState([])
  const [rawApiData, setRawApiData] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [selectedCandidates, setSelectedCandidates] = useState(new Set())
  const [exportingZip, setExportingZip] = useState(false)
  const [viewingCandidateId, setViewingCandidateId] = useState(null)
  const [exportFailedIds, setExportFailedIds] = useState([])
  const [showFailedModal, setShowFailedModal] = useState(false)
  const [exportFailedDetails, setExportFailedDetails] = useState([])
  const [exportOmittedDetails, setExportOmittedDetails] = useState([])
  const [showOmittedModal, setShowOmittedModal] = useState(false)
  const [showExportStructureModal, setShowExportStructureModal] = useState(false)
  const [selectedExportStructure, setSelectedExportStructure] = useState('hierarchical')
  const [selectedExportMode, setSelectedExportMode] = useState('report')
  const [showAgreementFormModal, setShowAgreementFormModal] = useState(false)
  const [showOfferLetterFormModal, setShowOfferLetterFormModal] = useState(false)
  const [showOfferLetterPreviewModal, setShowOfferLetterPreviewModal] = useState(false)
  const [showPoliceReportConfirmModal, setShowPoliceReportConfirmModal] = useState(false)
  const [agreementProjectId, setAgreementProjectId] = useState('')
  const [offerProjectId, setOfferProjectId] = useState('')
  const [projectOptions, setProjectOptions] = useState([])
  const [projectTemplateLoading, setProjectTemplateLoading] = useState(false)
  const [agreementFormData, setAgreementFormData] = useState({
    dateOfAgreement: new Date().toISOString().split('T')[0],
    recruitmentFor: '',
    recruitmentInfo: '',
    numberOfVenues: '',
    venueName: '',
    centreCode: '',
    reportingTimeFrom: '07:00',
    reportingTimeTo: '17:00',
    projectEndDate: '',
    witnessName: '',
    witnessDesignation: '',
    inrPerDay: '',
    governingState: '',
    bpsscConsent: 'BPSSC',
    companyConsent: 'CYNOSURE CORPORATE SOLUTIONS',
  })
  const [offerLetterFormData, setOfferLetterFormData] = useState({
    companyName: '',
    assignmentType: '',
    projectLocation: '',
    offerDate: '',
    projectStartDate: '',
    projectDuration: '',
    reserveDay: '',
    projectReportingTime: '',
    districtDeployment: '',
    trainingLocation: '',
    trainingReportingDate: '',
    trainingStartDate: '',
    trainingReportingTime: '',
    trainingDuration: '',
    travelReimbursement: '',
    foodAllowance: '',
    dinnerAllowance: '',
    dailyStipend: '',
    authorizedSignatoryName: '',
    authorizedSignatoryDesignation: '',
    authorizedSignatoryDate: new Date().toISOString().split('T')[0],
  })
  const exportAbortController = useRef({ isCancelled: false })
  const candidateInfoRef = useRef(null)

  const normalizeProjectOption = (item) => {
    if (!item || typeof item !== 'object') return null

    const id = item.id ?? item.project_id ?? item.projectId ?? item.value ?? item.project ?? ''
    if (!id && id !== 0) return null

    const label = item.name || item.project_name || item.projectName || item.title || `Project ${id}`
    return { id: String(id), label: String(label).trim() || `Project ${id}` }
  }

  const loadProjectOptions = async () => {
    try {
      const [projectsResponse, suggestionsResponse] = await Promise.allSettled([
        recruiterAPI.getProjects({ limit: 1000 }),
        recruiterAPI.getProjectSuggestions('', 1000),
      ])

      const merged = []
      const seen = new Set()

      const addItems = (payload) => {
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.data?.data)
              ? payload.data.data
              : []

        items.forEach((item) => {
          const normalized = normalizeProjectOption(item)
          if (!normalized) return
          if (seen.has(normalized.id)) return
          seen.add(normalized.id)
          merged.push(normalized)
        })
      }

      if (projectsResponse.status === 'fulfilled') addItems(projectsResponse.value?.data || projectsResponse.value)
      if (suggestionsResponse.status === 'fulfilled') addItems(suggestionsResponse.value?.data || suggestionsResponse.value)

      setProjectOptions(merged)
    } catch (err) {
      console.warn('Failed to load projects for template dropdowns', err)
      setProjectOptions([])
    }
  }

  const normalizeTemplateData = (payload = {}, fieldMap = {}) => {
    const source = payload && typeof payload === 'object' ? payload : {}
    const flattened = {
      ...(source.data || {}),
      ...(source.template || {}),
      ...(source.result || {}),
      ...(source.form || {}),
      ...source,
    }

    return Object.entries(fieldMap).reduce((acc, [key, candidates]) => {
      const value = candidates
        .map((candidate) => flattened[candidate])
        .find((item) => item !== undefined && item !== null && String(item).trim() !== '')

      if (value !== undefined && value !== null) {
        acc[key] = value
      }
      return acc
    }, {})
  }

  const applyProjectTemplate = async (projectId, templateType, setter) => {
    if (!projectId) return

    setProjectTemplateLoading(true)
    try {
      const response = await recruiterAPI.getProjectDocumentTemplate(projectId, templateType)
      const payload = response?.data?.data ?? response?.data ?? response ?? {}
      const source = payload?.data ?? payload?.template ?? payload?.result ?? payload?.form ?? payload
      const fieldMap = templateType === 'agreement'
        ? {
            dateOfAgreement: ['dateOfAgreement', 'date_of_agreement'],
            recruitmentFor: ['recruitmentFor', 'recruitment_for'],
            recruitmentInfo: ['recruitmentInfo', 'recruitment_info'],
            numberOfVenues: ['numberOfVenues', 'number_of_venues'],
            reportingTimeFrom: ['reportingTimeFrom', 'reporting_time_from'],
            reportingTimeTo: ['reportingTimeTo', 'reporting_time_to'],
            projectEndDate: ['projectEndDate', 'project_end_date'],
            witnessName: ['witnessName', 'witness_name'],
            witnessDesignation: ['witnessDesignation', 'witness_designation'],
            inrPerDay: ['inrPerDay', 'inr_per_day'],
            governingState: ['governingState', 'governing_state'],
            bpsscConsent: ['bpsscConsent', 'bpssc_consent'],
            companyConsent: ['companyConsent', 'company_consent'],
          }
        : {
            companyName: ['companyName', 'company_name'],
            assignmentType: ['assignmentType', 'assignment_type'],
            projectLocation: ['projectLocation', 'project_location'],
            offerDate: ['offerDate', 'offer_date'],
            projectStartDate: ['projectStartDate', 'project_start_date'],
            projectDuration: ['projectDuration', 'project_duration'],
            reserveDay: ['reserveDay', 'reserve_day'],
            projectReportingTime: ['projectReportingTime', 'project_reporting_time'],
            districtDeployment: ['districtDeployment', 'district_deployment'],
            trainingLocation: ['trainingLocation', 'training_location'],
            trainingReportingDate: ['trainingReportingDate', 'training_reporting_date'],
            trainingStartDate: ['trainingStartDate', 'training_start_date'],
            trainingReportingTime: ['trainingReportingTime', 'training_reporting_time'],
            trainingDuration: ['trainingDuration', 'training_duration'],
            travelReimbursement: ['travelReimbursement', 'travel_reimbursement'],
            foodAllowance: ['foodAllowance', 'food_allowance'],
            dinnerAllowance: ['dinnerAllowance', 'dinner_allowance'],
            dailyStipend: ['dailyStipend', 'daily_stipend'],
            authorizedSignatoryName: ['authorizedSignatoryName', 'authorized_signatory_name'],
            authorizedSignatoryDesignation: ['authorizedSignatoryDesignation', 'authorized_signatory_designation'],
            authorizedSignatoryDate: ['authorizedSignatoryDate', 'authorized_signatory_date'],
          }

      const templateValues = normalizeTemplateData(source, fieldMap)
      if (Object.keys(templateValues).length > 0) {
        setter((current) => ({ ...current, ...templateValues }))
      }
    } catch (err) {
      if (err?.response?.status !== 404) {
        console.warn(`Could not load ${templateType} template`, err)
      }
    } finally {
      setProjectTemplateLoading(false)
    }
  }

  const persistProjectTemplate = async (projectId, templateType, payload = {}) => {
    if (!projectId) return

    const sanitizedPayload = Object.fromEntries(
      Object.entries(payload).filter(([key, value]) => {
        if (['venueName', 'centreCode'].includes(key)) return false
        if (value === undefined || value === null) return false
        if (typeof value === 'string' && !value.trim()) return false
        return true
      })
    )

    try {
      await recruiterAPI.saveProjectDocumentTemplate(projectId, templateType, sanitizedPayload)
    } catch (err) {
      console.warn(`Could not save ${templateType} template`, err)
    }
  }

  const saveDocumentExportRecords = async (rowIds, projectId, documentType, documentPayload = {}, failedIds = []) => {
    if (!projectId) {
      console.warn(`[saveDocumentExportRecords] Missing projectId for ${documentType} export`)
      return
    }

    const failedIdSet = new Set((failedIds || []).map((id) => String(id)))
    const candidates = rowIds.flatMap((rowId) => {
      const candidateRow = results.find((row) => String(row.id) === String(rowId))
      const candidateId = candidateRow?.candidateId || rowId
      if (!candidateRow || failedIdSet.has(String(candidateId))) return []
      const sheetData = candidateRow.uploadedData?.data || {}

      return [{
        candidate_id: candidateId,
        candidate_snapshot: {
          ...sheetData,
          candidate_id: candidateId,
          name: candidateRow.name || sheetData.name || '',
          mobile: candidateRow.mobile || sheetData.mobile || '',
          aadhaar_number: candidateRow.aadhaar || sheetData.aadhaar || '',
          district: candidateRow.district || sheetData.district || '',
          centre: candidateRow.centre || sheetData.centre || '',
          centre_code: candidateRow.centreCode || sheetData.centre_code || '',
          location: candidateRow.location || sheetData.location || '',
          designation: candidateRow.designation || sheetData.designation || '',
          status: candidateRow.status || '',
        },
        sheet_context: {
          parsed: sheetData,
        },
        document_payload: documentPayload,
        status: 'generated',
        template_version: 'v1.0',
      }]
    })

    if (candidates.length === 0) return

    try {
      console.log(`[saveDocumentExportRecords] Saving ${candidates.length} ${documentType} export records in one request`, candidates)
      const response = await recruiterAPI.saveDocumentExports(projectId, documentType, candidates)
      console.log(`[saveDocumentExportRecords] Successfully saved ${candidates.length} ${documentType} export records`, response)
    } catch (err) {
      console.error(`[saveDocumentExportRecords] Error saving ${documentType} export records:`, err)
    }
  }

  useEffect(() => {
    loadProjectOptions()
  }, [])

  const filteredResults = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase()
    const status = String(statusFilter || 'all').toLowerCase()

    return results.filter((item) => {
      const matchesSearch = !term || [item.name, item.mobile, item.aadhaar, item.status, item.location, item.district, item.centre, item.centreCode, item.centerid]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))

      const itemStatus = getStatusCategory(item.status) // verified, not_verified, not_registered
      let matchesStatus = true
      if (status === 'verified') {
        matchesStatus = itemStatus === 'verified'
      } else if (status === 'not_verified') {
        matchesStatus = itemStatus === 'not_verified'
      } else if (status === 'not_registered') {
        matchesStatus = itemStatus === 'not_registered'
      }

      return matchesSearch && matchesStatus
    })
  }, [searchTerm, results, statusFilter])

  const verifiedCount = results.filter((item) => getStatusCategory(item.status) === 'verified').length
  const notVerifiedCount = results.filter((item) => getStatusCategory(item.status) === 'not_verified').length
  const notRegisteredCount = results.filter((item) => getStatusCategory(item.status) === 'not_registered').length

  const handleFileChange = async (e) => {
    const selected = e.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }

    if (!isSupportedSheetFile(selected)) {
      setError('Please upload a CSV, XLS, or XLSX file.')
      setFile(null)
      setResults([])
      setRawApiData([])
      return
    }

    setFile(selected)
    setError('')
    setInfo('')
    setResults([])
    setRawApiData([])
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const selected = files[0]
      if (!isSupportedSheetFile(selected)) {
        setError('Please upload a CSV, XLS, or XLSX file.')
        setFile(null)
        setResults([])
        setRawApiData([])
        return
      }
      setFile(selected)
      setError('')
      setInfo('')
      setResults([])
      setRawApiData([])
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setInfo('')

    if (!file) {
      setError('Please select a CSV file to upload.')
      return
    }

    setLoading(true)
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const parsedSheetData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
        .map((row, index) => normalizeSheetRow(row, index + 2))
      const formData = new FormData()
      formData.append('file', file)
      const apiResponse = await recruiterAPI.checkKYCStatus(formData)
      const apiDataRaw = apiResponse?.data?.data ?? apiResponse?.data ?? []
      const apiData = Array.isArray(apiDataRaw)
        ? apiDataRaw
        : Array.isArray(apiDataRaw?.items)
          ? apiDataRaw.items
          : []

      setRawApiData(apiData)
      const mappedApiRows = apiData.map((item, index) => {
        const uploadedRow = findUploadedSheetRow(item, parsedSheetData, index)
        return mapResultRow(item, index, uploadedRow || {})
      })
      setResults(mappedApiRows)

      if (mappedApiRows.length === 0) {
        setInfo('The API returned no records for this file.')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to upload file. Please try again.')
      setResults([])
      setRawApiData([])
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setResults([])
    setRawApiData([])
    setSearchTerm('')
    setStatusFilter('all')
    setError('')
    setInfo('')
    setSelectedCandidates(new Set())
  }
  const [selectedProjectType, setSelectedProjectType] = useState('location')

  const downloadSampleTemplate = () => {
    let headers, sampleRows, fileName
    
    if (selectedProjectType === 'location') {
      // Location-based template
      headers = ['Location', 'Name', 'MobileNo', 'AadharNo', 'Designation']
      sampleRows = [
        ['Bangalore', 'CHANDRASEKHAR KUMAR', '8102766709', '970934597099', 'Manager'],
        ['Mumbai', 'Shubham Bhardwaj', '9608036253', '470372427217', 'Executive'],
        ['Delhi', 'RAUSHAN KUMAR', '7541048716', '774524199077', 'Supervisor'],
      ]
      fileName = 'check_kyc_sample_location.csv'
    } else {
      // District/Centre based template
      headers = ['District', 'Centre code', 'Centre', 'Name', 'MobileNo', 'AadharNo', 'Designation']
      sampleRows = [
        ['Bangalore Rural', 'WF001', 'Whitefield Center', 'CHANDRASEKHAR KUMAR', '8102766709', '970934597099', 'Manager'],
        ['Mumbai Suburban', 'TN002', 'Thane Center', 'Shubham Bhardwaj', '9608036253', '470372427217', 'Executive'],
        ['Delhi', 'ND003', 'Noida Center', 'RAUSHAN KUMAR', '7541048716', '774524199077', 'Supervisor'],
      ]
      fileName = 'check_kyc_sample_district.csv'
    }
    
    const csvRows = [headers.join(','), ...sampleRows.map((row) => row.join(','))]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = fileName
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const handleBulkExport = async () => {
    if (selectedCandidates.size === 0) return
    // Show structure selection modal
    setShowExportStructureModal(true)
  }

  const handleConfirmExport = async () => {
    // Handle Agreement export - show form modal first
    if (selectedExportMode === 'agreement') {
      setShowExportStructureModal(false)
      setShowAgreementFormModal(true)
      return
    }

    if (selectedExportMode === 'offer_letter') {
      setShowExportStructureModal(false)
      setShowOfferLetterFormModal(true)
      return
    }

    // Handle Profile Image Only (Excel) export
    if (selectedExportMode === 'profile_image_excel') {
      setShowExportStructureModal(false)
      const selectedRowIds = Array.from(selectedCandidates)
      const selectedRows = results.filter((r) => selectedRowIds.includes(String(r.id)))
      await handleExportProfileImageExcel([], selectedRows)
      return
    }

    setShowExportStructureModal(false)
    setExportingZip(true)
    exportAbortController.current.isCancelled = false
    try {
      // Preserve row-level selection so duplicate rows are treated independently.
      const selectedRowIds = Array.from(selectedCandidates)
      const selectedRows = results.filter((r) => selectedRowIds.includes(String(r.id)))
      const result = await bulkExportAsZip(selectedRowIds, results, rawApiData, exportAbortController.current, selectedExportStructure, selectedExportMode, agreementFormData)
      if (result.success) {
        setSelectedCandidates(new Set())
        
        // For Profile Image Only mode, also export the Excel file with actual extensions
        if (selectedExportMode === 'profile') {
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: 'ℹ️', message: 'Also generating profile images list...', duration: 0 } }))
          await handleExportProfileImageExcel(result.profileImageExportItems || [], selectedRows)
        }
        
        // Store failed IDs for user to view/download
        if (result.failedIds && result.failedIds.length > 0) {
          setExportFailedIds(result.failedIds)
          setExportFailedDetails(result.failedDetails || [])
          setShowFailedModal(true)
        }
        // Omitted items (not found or excluded) - show them separately
        if (result.omittedDetails && result.omittedDetails.length > 0) {
          setExportOmittedDetails(result.omittedDetails)
          setShowOmittedModal(true)
        }
      } else if (!result.cancelled) {
        alert('Failed to generate ZIP file. Please try again.')
      }
    } catch (err) {
      console.error('Export error:', err)
      alert('An error occurred during export. Please try again.')
    } finally {
      setExportingZip(false)
      exportAbortController.current.isCancelled = false
    }
  }

  const handleCancelExport = () => {
    exportAbortController.current.isCancelled = true
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: {
        type: 'warning',
        icon: '⚠️',
        message: 'Cancelling export...',
        duration: 2000
      }
    }))
  }

  const handleAgreementFormSubmit = async () => {
    const requiredFields = ['dateOfAgreement', 'recruitmentInfo', 'numberOfVenues', /* venueName and centreCode optional */ 'projectEndDate', 'reportingTimeFrom', 'reportingTimeTo', 'witnessName', 'witnessDesignation', 'inrPerDay', 'governingState', 'bpsscConsent', 'companyConsent']
    const missingFields = requiredFields.filter(field => !agreementFormData[field])

    if (missingFields.length > 0) {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Please fill in all required fields: ${missingFields.join(', ')}`, duration: 4000 } }))
      return
    }

    await persistProjectTemplate(agreementProjectId, 'agreement', agreementFormData)

    setShowAgreementFormModal(false)
    setTimeout(() => {
      setShowPoliceReportConfirmModal(true)
    }, 100)
  }

  const handleOfferLetterFormSubmit = async () => {
    const requiredFields = ['companyName', 'assignmentType', 'projectLocation', 'offerDate', 'projectStartDate', 'projectDuration', 'reserveDay', 'projectReportingTime', 'districtDeployment', 'trainingLocation', 'trainingReportingDate', 'trainingStartDate', 'trainingReportingTime', 'trainingDuration', 'travelReimbursement', 'foodAllowance', 'dinnerAllowance', 'dailyStipend', 'authorizedSignatoryName', 'authorizedSignatoryDesignation', 'authorizedSignatoryDate']
    const missingFields = requiredFields.filter((field) => !String(offerLetterFormData[field] || '').trim())
    if (missingFields.length > 0) {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: `Please fill in all required offer letter fields: ${missingFields.join(', ')}`, duration: 4000 } }))
      return
    }

    await persistProjectTemplate(offerProjectId, 'offer_letter', offerLetterFormData)

    setShowOfferLetterFormModal(false)
    setExportingZip(true)
    exportAbortController.current.isCancelled = false
    try {
      const selectedRowIds = Array.from(selectedCandidates)
      console.log('[handleOfferLetterFormSubmit] Starting export with selectedRowIds:', selectedRowIds, 'projectId:', offerProjectId)
      const result = await bulkExportAsZip(selectedRowIds, results, rawApiData, exportAbortController.current, selectedExportStructure, 'offer_letter', offerLetterFormData)
      console.log('[handleOfferLetterFormSubmit] bulkExportAsZip result:', result)
      if (result.success) {
        console.log('[handleOfferLetterFormSubmit] Export successful, saving export records for', selectedRowIds.length, 'candidates')
        // Save export records for each candidate that was successfully exported
        await saveDocumentExportRecords(selectedRowIds, offerProjectId, 'offer_letter', offerLetterFormData, result.failedIds)
        setSelectedCandidates(new Set())
        if (result.failedIds?.length > 0) {
          setExportFailedIds(result.failedIds)
          setExportFailedDetails(result.failedDetails || [])
          setShowFailedModal(true)
        }
        if (result.omittedDetails?.length > 0) {
          setExportOmittedDetails(result.omittedDetails)
          setShowOmittedModal(true)
        }
      } else if (!result.cancelled) {
        alert('Failed to generate Offer Letter ZIP file. Please try again.')
      }
    } catch (err) {
      console.error('Offer Letter export error:', err)
      alert('An error occurred during Offer Letter export. Please try again.')
    } finally {
      setExportingZip(false)
      exportAbortController.current.isCancelled = false
    }
  }

  const handlePoliceReportConfirmation = async (includePoliceReport) => {
    setShowPoliceReportConfirmModal(false)
    setShowAgreementFormModal(false)
    setExportingZip(true)
    exportAbortController.current.isCancelled = false
    try {
      const selectedRowIds = Array.from(selectedCandidates)
      const selectedRows = results.filter((r) => selectedRowIds.includes(String(r.id)))
      const exportModeToUse = includePoliceReport ? 'agreement_with_police' : selectedExportMode
      console.log('[handlePoliceReportConfirmation] Starting export with selectedRowIds:', selectedRowIds, 'projectId:', agreementProjectId, 'mode:', exportModeToUse)
      const result = await bulkExportAsZip(selectedRowIds, results, rawApiData, exportAbortController.current, selectedExportStructure, exportModeToUse, agreementFormData)
      console.log('[handlePoliceReportConfirmation] bulkExportAsZip result:', result)
      if (result.success) {
        console.log('[handlePoliceReportConfirmation] Export successful, saving export records for', selectedRowIds.length, 'candidates')
        // Save export records for each candidate that was successfully exported
        const documentType = includePoliceReport ? 'agreement_with_police' : 'agreement'
        await saveDocumentExportRecords(selectedRowIds, agreementProjectId, documentType, agreementFormData, result.failedIds)
        setSelectedCandidates(new Set())
        
        if (result.failedIds && result.failedIds.length > 0) {
          setExportFailedIds(result.failedIds)
          setExportFailedDetails(result.failedDetails || [])
          setShowFailedModal(true)
        }
        if (result.omittedDetails && result.omittedDetails.length > 0) {
          setExportOmittedDetails(result.omittedDetails)
          setShowOmittedModal(true)
        }
      } else if (!result.cancelled) {
        alert('Failed to generate ZIP file. Please try again.')
      }
    } catch (err) {
      console.error('Export error:', err)
      alert('An error occurred during export. Please try again.')
    } finally {
      setExportingZip(false)
      exportAbortController.current.isCancelled = false
    }
  }


  const handleSelectAll = () => {
    const pageIds = filteredResults.map(r => String(r.id))
    const allSelectedOnPage = pageIds.length > 0 && pageIds.every(id => selectedCandidates.has(id))
    const newSelected = new Set(selectedCandidates)
    if (allSelectedOnPage) {
      // remove page ids
      pageIds.forEach(id => newSelected.delete(id))
    } else {
      // add page ids
      pageIds.forEach(id => newSelected.add(id))
    }
    setSelectedCandidates(newSelected)
  }

  const downloadFailedIds = () => {
    if (exportFailedIds.length === 0 && exportFailedDetails.length === 0) return

    // Prefer detailed failure list if available
    const rows = (exportFailedDetails && exportFailedDetails.length > 0)
      ? exportFailedDetails.map(d => {
        const c = results.find(r => String(r.candidateId) === String(d.candidateId)) || {}
        return [d.candidateId, c.name || '', c.mobile || '', c.aadhaar || '', c.status || '', d.reason || '']
      })
      : exportFailedIds.map(id => {
        const c = results.find(r => String(r.candidateId) === String(id)) || {}
        return [id, c.name || '', c.mobile || '', c.aadhaar || '', c.status || '', 'unknown']
      })

    // Create CSV with reason column
    const headers = ['Candidate ID', 'Name', 'Mobile', 'Aadhaar', 'Status', 'Reason']
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `failed_candidates_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const downloadOmittedIds = () => {
    if (!exportOmittedDetails || exportOmittedDetails.length === 0) return

    const rows = exportOmittedDetails.map(d => {
      const c = results.find(r => String(r.candidateId) === String(d.candidateId)) || {}
      return [d.candidateId, c.name || '', c.mobile || '', c.aadhaar || '', c.status || '', d.reason || '']
    })

    const headers = ['Candidate ID', 'Name', 'Mobile', 'Aadhaar', 'Status', 'Reason']
    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `omitted_candidates_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
  }

  const handleExportChairmanReport = async () => {
    if (!file && (!rawApiData || rawApiData.length === 0)) {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: 'Please upload a file first', duration: 2000 } }))
      return
    }

    try {
      let apiItems = []

      if (Array.isArray(rawApiData) && rawApiData.length > 0) {
        apiItems = rawApiData
      } else {
        // Fallback to the API only if the page does not already have data loaded.
        const formData = new FormData()
        formData.append('file', file)

        const response = await recruiterAPI.checkKYCStatus(formData)
        const apiData = response?.data || response

        if (!apiData?.data || !Array.isArray(apiData.data)) {
          window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: 'Invalid response format', duration: 2000 } }))
          return
        }

        apiItems = apiData.data
      }

      // Group data by district and centre code so spelling differences in centre names do not create duplicate rows
      const groupedData = {}
      apiItems.forEach(item => {
        const district = String(item.district || 'Unknown').trim() || 'Unknown'
        const centreCode = String(item.centre_code || item.centreCode || item.centerid || item.centre_id || '').trim()
        const key = `${district}|${centreCode || 'UNKNOWN_CODE'}`
        if (!groupedData[key]) {
          groupedData[key] = {
            district,
            centre_code: centreCode,
            centre_name: item.centre_name || item.centre || '',
            'KYC Completed': { Operators: 0, Supervisors: 0, Videographers: 0 },
            'KYC Pending': { Operators: 0, Supervisors: 0, Videographers: 0 },
            'Not Registered': { Operators: 0, Supervisors: 0, Videographers: 0 }
          }
        } else {
          if (!groupedData[key].centre_code && centreCode) {
            groupedData[key].centre_code = centreCode
          }
          if (!groupedData[key].centre_name && (item.centre_name || item.centre)) {
            groupedData[key].centre_name = item.centre_name || item.centre || ''
          }
        }

        // Determine KYC status category
        let statusCategory = 'Not Registered'
        if (item.kyc_status === 'Verified' || item.kyc_status === 'Valid') {
          statusCategory = 'KYC Completed'
        } else if (item.kyc_status === 'Not verified' || item.kyc_status === 'Pending' || item.kyc_status === 'Not Verified') {
          statusCategory = 'KYC Pending'
        }

        // Map designation to category
        const designation = (item.Designation || item.designation || '').toLowerCase()
        let designationCategory = 'Operators' // default

        if (designation.includes('supervisor') || designation.includes('superviser')) {
          designationCategory = 'Supervisors'
        } else if (designation.includes('videographer') || designation.includes('video')) {
          designationCategory = 'Videographers'
        }

        groupedData[key][statusCategory][designationCategory]++
      })

      // Create header rows for merged cells
      const categoryHeader = ['', '', '', '', 'KYC Completed', '', '', '', 'KYC Pending', '', '', '', 'Not Registered', '', '', '']
      const subHeader = ['S.No', 'District', 'Center Code', 'Center Name', 'Operators', 'Supervisors', 'Videographers', 'TOTAL', 'Operators', 'Supervisors', 'Videographers', 'TOTAL', 'Operators', 'Supervisors', 'Videographers', 'TOTAL']

      const getGroupSortValue = (value) => {
        const raw = String(value ?? '').trim()
        if (!raw) return { numeric: Number.POSITIVE_INFINITY, text: '' }
        const numeric = Number(raw.replace(/\D/g, ''))
        return Number.isFinite(numeric) ? { numeric, text: raw.toLowerCase() } : { numeric: Number.POSITIVE_INFINITY, text: raw.toLowerCase() }
      }

      const sortedGroups = Object.values(groupedData).sort((a, b) => {
        const districtCompare = String(a.district || 'Unknown').localeCompare(String(b.district || 'Unknown'), undefined, { sensitivity: 'base' })
        if (districtCompare !== 0) return districtCompare

        const aCode = getGroupSortValue(a.centre_code)
        const bCode = getGroupSortValue(b.centre_code)
        if (aCode.numeric !== bCode.numeric) return aCode.numeric - bCode.numeric
        return aCode.text.localeCompare(bCode.text, undefined, { sensitivity: 'base' })
      })

      // Convert grouped data to report format
      const reportRows = sortedGroups.map((group, index) => [
        index + 1,
        group.district,
        group.centre_code,
        group.centre_name,
        group['KYC Completed'].Operators,
        group['KYC Completed'].Supervisors,
        group['KYC Completed'].Videographers,
        group['KYC Completed'].Operators + group['KYC Completed'].Supervisors + group['KYC Completed'].Videographers,
        group['KYC Pending'].Operators,
        group['KYC Pending'].Supervisors,
        group['KYC Pending'].Videographers,
        group['KYC Pending'].Operators + group['KYC Pending'].Supervisors + group['KYC Pending'].Videographers,
        group['Not Registered'].Operators,
        group['Not Registered'].Supervisors,
        group['Not Registered'].Videographers,
        group['Not Registered'].Operators + group['Not Registered'].Supervisors + group['Not Registered'].Videographers
      ])

      // Combine headers with data
      const sheetData = [categoryHeader, subHeader, ...reportRows]

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(sheetData)

      // Define border style
      const borderStyle = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } }
      }

      // Define header styles
      const categoryHeaderStyle = {
        font: { bold: true, size: 12, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '366092' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderStyle
      }

      const subHeaderStyle = {
        font: { bold: true, size: 11, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4472C4' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderStyle
      }

      const dataStyle = {
        font: { size: 10 },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: borderStyle
      }

      // Apply styles to all cells
      const range = XLSX.utils.decode_range(ws['!ref'])
      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })
          if (!ws[cellAddress]) continue

          if (row === 0) {
            // Category header row
            ws[cellAddress].s = categoryHeaderStyle
          } else if (row === 1) {
            // Sub-header row
            ws[cellAddress].s = subHeaderStyle
          } else {
            // Data rows
            ws[cellAddress].s = dataStyle
          }
        }
      }

      // Set column widths
      ws['!cols'] = [
        { wch: 8 },   // S.No
        { wch: 20 },  // District
        { wch: 15 },  // Center Code
        { wch: 30 },  // Center Name
        { wch: 12 },  // Operators (Completed)
        { wch: 14 },  // Supervisors (Completed)
        { wch: 16 },  // Videographers (Completed)
        { wch: 10 },  // TOTAL (Completed)
        { wch: 12 },  // Operators (Pending)
        { wch: 14 },  // Supervisors (Pending)
        { wch: 16 },  // Videographers (Pending)
        { wch: 10 },  // TOTAL (Pending)
        { wch: 12 },  // Operators (Not Registered)
        { wch: 14 },  // Supervisors (Not Registered)
        { wch: 16 },  // Videographers (Not Registered)
        { wch: 10 }   // TOTAL (Not Registered)
      ]

      // Add merged cells for category headers
      ws['!merges'] = [
        { s: { r: 0, c: 4 }, e: { r: 0, c: 7 } },   // KYC Completed
        { s: { r: 0, c: 8 }, e: { r: 0, c: 11 } },  // KYC Pending
        { s: { r: 0, c: 12 }, e: { r: 0, c: 15 } }  // Not Registered
      ]

      // Create workbook
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Chairman Report')

      // Generate file
      const filename = `chairman_report_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)

      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'success', icon: '✅', message: 'Chairman report exported', duration: 2000 } }))
    } catch (err) {
      console.error('Chairman report export failed:', err)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: 'Failed to export chairman report', duration: 3000 } }))
    }
  }

  const handleExportProfileImageExcel = async (profileImageExportItems = [], selectedRows = []) => {
    if (selectedCandidates.size === 0 && (!selectedRows || selectedRows.length === 0)) return
    try {
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'info', icon: 'ℹ️', message: 'Generating profile images list...', duration: 0 } }))
      
      const rows = createProfileImageExcelRows(selectedRows, rawApiData, profileImageExportItems)

      if (rows.length === 0) {
        window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'warning', icon: '⚠️', message: 'No profile images available for export', duration: 2500 } }))
        return
      }

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Profile Images')

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      const filename = `profile_images_${new Date().toISOString().split('T')[0]}.xlsx`
      saveAs(blob, filename)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'success', icon: '✅', message: 'Profile images list exported', duration: 2000 } }))
    } catch (err) {
      console.error('Excel export failed:', err)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: 'Failed to export Excel', duration: 3000 } }))
    }
  }

  const handleExportExcel = () => {
    if (selectedCandidates.size === 0) return
    try {
      const selectedIds = new Set(Array.from(selectedCandidates).map(String))
      const selectedRows = results.filter(r => selectedIds.has(String(r.id)))
      const hasLocationData = selectedRows.some(r => r.location && String(r.location).trim().length > 0)

      const mapRow = (r, index) => {
        const row = {
          'S.No': index + 1,
          'Name': r.name || '',
          'Mobile': r.mobile || '',
          'Aadhaar': r.aadhaar || ''
        }

        if (hasLocationData) {
          row.Location = r.location || ''
        }

        row['District'] = r.district || ''
        row['Centre'] = r.centre || ''
        row['Centre Code'] = r.centreCode || r.centerid || r.centre_id || r.centerId || ''
        row['Status'] = r.status || ''
        return row
      }

      const allRows = selectedRows.map(mapRow)
      const verifiedRows = selectedRows.filter(r => getStatusCategory(r.status) === 'verified').map((r, index) => mapRow(r, index))
      const notVerifiedRows = selectedRows.filter(r => getStatusCategory(r.status) === 'not_verified').map((r, index) => mapRow(r, index))
      const notRegisteredRows = selectedRows.filter(r => getStatusCategory(r.status) === 'not_registered').map((r, index) => mapRow(r, index))
      const registeredRows = [...verifiedRows, ...notVerifiedRows]

      const wb = XLSX.utils.book_new()
      // Ensure sheets exist even if empty
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(allRows.length ? allRows : [{ Note: 'No data' }]), 'All')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(verifiedRows.length ? verifiedRows : [{ Note: 'No data' }]), 'Verified')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notVerifiedRows.length ? notVerifiedRows : [{ Note: 'No data' }]), 'Not Verified')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notRegisteredRows.length ? notRegisteredRows : [{ Note: 'No data' }]), 'Not Registered')
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(registeredRows.length ? registeredRows : [{ Note: 'No data' }]), 'Registered')

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      const filename = `candidates_export_${new Date().toISOString().split('T')[0]}.xlsx`
      saveAs(blob, filename)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'success', icon: '✅', message: 'Excel exported', duration: 2000 } }))
    } catch (err) {
      console.error('Excel export failed:', err)
      window.dispatchEvent(new CustomEvent('apiMessage', { detail: { type: 'error', icon: '❌', message: 'Failed to export Excel', duration: 3000 } }))
    }
  }

  const columns = getColumnsFromData(results, rawApiData, results.length > 0)
  const rows = buildTableRows(filteredResults, columns, selectedCandidates, setSelectedCandidates, setViewingCandidateId)

  const pageAllSelected = filteredResults.length > 0 && filteredResults.every(r => selectedCandidates.has(String(r.id)))

  const handleViewCandidate = (candidateId) => {
    setViewingCandidateId(candidateId)
  }

  const offerPreviewCandidate = results.find((row) => selectedCandidates.has(String(row.id))) || results[0] || {}

  return (
    <div className="check-kyc-page">
      <PageHeader
        title="Check KYC"
        subtitle="Upload a candidate CSV and review KYC verification status for each record."
        action={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/recruiter/document-history?type=offer_letter')}>
              <FontAwesomeIcon icon={faFileArchive} /> Offers History
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigate('/app/recruiter/document-history?type=agreement')}>
              <FontAwesomeIcon icon={faFileArchive} /> Agreements History
            </button>
            {(file || results.length > 0) && (
              <button type="button" className="btn btn-outline btn-sm" onClick={clearFile}>
                <FontAwesomeIcon icon={faHistory} /> New Check
              </button>
            )}
          </div>
        }
      />

      <div className="check-kyc-content" style={{ display: 'grid', gap: '24px' }}>
        {results.length === 0 && (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', background: 'var(--bg-light)', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text2)', margin: 0 }}>
                  Select Project Type:
                </label>
                <select
                  value={selectedProjectType}
                  onChange={(e) => setSelectedProjectType(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-white)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    minWidth: '250px'
                  }}
                >
                  <option value="location">Location-based Project</option>
                  <option value="district">District/Centre-based Project</option>
                </select>
              </div>
            </div>
            <form onSubmit={handleSubmit}>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
                  margin: '24px',
                  borderRadius: '12px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: dragActive ? 'var(--blue-light)' : 'var(--bg-light)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <input
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  id="file-input"
                />

                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  background: file ? 'var(--green-light)' : 'var(--primary-light)', 
                  color: file ? 'var(--green)' : 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  marginBottom: '8px'
                }}>
                  <FontAwesomeIcon icon={file ? faCheckCircle : faUpload} />
                </div>

                <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text1)' }}>
                    {file ? file.name : 'Choose a CSV file'}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text3)', marginTop: '4px' }}>
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or drag and drop it here'}
                  </div>
                </label>

                {!file && (
                  <button type="button" className="btn btn-link btn-sm" onClick={downloadSampleTemplate} style={{ marginTop: '8px' }}>
                    <FontAwesomeIcon icon={faDownload} /> Download Sample Template
                  </button>
                )}
              </div>

              <div style={{ 
                padding: '16px 24px', 
                background: 'var(--bg-light)', 
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                {file && (
                  <button type="button" className="btn btn-outline" onClick={clearFile} disabled={loading}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="btn btn-primary" disabled={!file || loading} style={{ minWidth: '160px' }}>
                  {loading ? <><FontAwesomeIcon icon={faSpinner} spin /> Analyzing...</> : 'Check Status'}
                </button>
              </div>
            </form>
            {error && (
              <div style={{ margin: '0 24px 24px', padding: '12px', background: 'var(--red-light)', color: 'var(--red)', borderRadius: '8px', fontSize: '13px', borderLeft: '4px solid var(--red)' }}>
                {error}
              </div>
            )}
          </Card>
        )}

        {results.length > 0 && (
          <>
            <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <StatCard label="Total Checked" value={results.length} icon="📊" />
              <StatCard label="Verified" value={verifiedCount} icon="✅" iconStyle={{ background: 'var(--green-light)', color: 'var(--green)' }} />
              <StatCard label="Not Verified" value={notVerifiedCount} icon="⏳" iconStyle={{ background: 'var(--yellow-light)', color: 'var(--saffron)' }} />
              <StatCard label="Not Registered" value={notRegisteredCount} icon="❌" iconStyle={{ background: 'var(--red-light)', color: 'var(--red)' }} />
            </div>

            <Card style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Filter by Status:</div>
                  <Tabs
                    tabs={[
                      { id: 'all', label: 'All' },
                      { id: 'verified', label: 'Verified' },
                      { id: 'not_verified', label: 'Not Verified' },
                      { id: 'not_registered', label: 'Not Registered' }
                    ]}
                    activeTab={statusFilter}
                    onTabChange={setStatusFilter}
                  />
                </div>

                <div className="filter-search-box" style={{ margin: 0, flex: '1 1 300px', maxWidth: '400px' }}>
                  <FontAwesomeIcon icon={faSearch} className="filter-search-icon" />
                  <input
                    className="form-control"
                    placeholder="Search in results..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {selectedCandidates.size > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                      {selectedCandidates.size} selected
                    </span>
                    {!exportingZip ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleExportExcel}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faFileCsv} /> Export Excel
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={handleExportChairmanReport}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faDownload} /> Export Chairman Report
                        </button>
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={handleBulkExport}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faFileArchive} />
                          Export as ZIP
                        </button>
                      </>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          disabled
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faSpinner} spin /> Exporting...
                        </button>
                        <button 
                          className="btn btn-outline btn-sm" 
                          onClick={handleCancelExport}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <FontAwesomeIcon icon={faTimes} /> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Results Table */}
      <Card style={{ padding: 20, marginTop: 24 }}>
        {results.length > 0 && (
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
                type="checkbox"
                checked={pageAllSelected}
                onChange={handleSelectAll}
                style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                title={pageAllSelected ? 'Deselect all' : 'Select all'}
              />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text3)' }}>
                {pageAllSelected ? 'All selected on this page' : 'Select all on this page'}
            </span>
          </div>
        )}
        <div style={{ minHeight: 260 }}>
          {results.length > 0 ? (
            <DataTable columns={columns} rows={rows} emptyMessage="No matching results found." />
          ) : (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
              <FontAwesomeIcon icon={faFileCsv} size="3x" style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Upload a CSV to check KYC status.</div>
              <div>Results will appear here after the file is processed.</div>
            </div>
          )}
        </div>
      </Card>

      {/* Candidate Info Modal */}
      {viewingCandidateId && (
        <Modal
          isOpen={true}
          onClose={() => setViewingCandidateId(null)}
          title={`Candidate Details`}
          fullScreen
        >
          <CandidateInfo candidateId={viewingCandidateId} />
        </Modal>
      )}

      {/* Failed Export Modal */}
      {showFailedModal && exportFailedIds.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => setShowFailedModal(false)}
          title={`Export Failed - ${exportFailedIds.length} Candidates`}
        >
          <div style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--red-light)', borderRadius: '8px', fontSize: '14px', color: 'var(--red)' }}>
              <strong>{exportFailedIds.length} candidate(s) failed to export.</strong> This could be due to API timeouts or data loading issues. You can retry exporting these candidates or download the list below for reference.
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Failed Candidates:</h4>
              <div style={{ background: 'var(--bg-light)', borderRadius: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {exportFailedIds.map((id, idx) => {
                  const candidate = results.find(r => String(r.candidateId) === String(id))
                  const detail = exportFailedDetails.find(d => String(d.candidateId) === String(id))
                  return candidate ? (
                    <div
                      key={id}
                      style={{
                        padding: '12px 16px',
                        borderBottom: idx < exportFailedIds.length - 1 ? '1px solid var(--border-light)' : 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{candidate.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                          ID: {candidate.candidateId} | Mobile: {candidate.mobile}
                        </div>
                        {detail?.reason && (
                          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>Reason: {detail.reason}</div>
                        )}
                      </div>
                      <FontAwesomeIcon icon={faTimes} style={{ color: 'var(--red)', opacity: 0.5 }} />
                    </div>
                  ) : null
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowFailedModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={downloadFailedIds}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FontAwesomeIcon icon={faDownload} /> Download Failed List
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Omitted Items Modal */}
      {showOmittedModal && exportOmittedDetails.length > 0 && (
        <Modal
          isOpen={true}
          onClose={() => setShowOmittedModal(false)}
          title={`Omitted From Export - ${exportOmittedDetails.length} Candidates`}
        >
          <div style={{ padding: '20px', maxHeight: '600px', overflowY: 'auto' }}>
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--yellow-light)', borderRadius: '8px', fontSize: '14px', color: 'var(--saffron)' }}>
              <strong>{exportOmittedDetails.length} candidate(s) were omitted before export.</strong> They were excluded because of missing data or status. You can review and download the list below.
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 600 }}>Omitted Candidates:</h4>
              <div style={{ background: 'var(--bg-light)', borderRadius: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {exportOmittedDetails.map((d, idx) => {
                  const candidate = results.find(r => String(r.candidateId) === String(d.candidateId))
                  return (
                    <div key={d.candidateId} style={{ padding: '12px 16px', borderBottom: idx < exportOmittedDetails.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{candidate?.name || d.candidateId}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text3)' }}>ID: {d.candidateId} {candidate ? `| Mobile: ${candidate.mobile}` : ''}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>Reason: {d.reason}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowOmittedModal(false)}>Close</button>
              <button type="button" className="btn btn-primary" onClick={downloadOmittedIds} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FontAwesomeIcon icon={faDownload} /> Download Omitted List
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Export Structure Selection Modal */}
      {showExportStructureModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowExportStructureModal(false)}
          title="Choose Export Structure"
          style={{ zIndex: 9999 }}
        >
          <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ color: 'var(--text2)', marginBottom: '16px', fontSize: '14px' }}>
                How would you like to organize the PDFs in the ZIP file?
              </p>

              {/* Flat Structure Option */}
              <div
                onClick={() => setSelectedExportStructure('flat')}
                style={{
                  padding: '16px',
                  marginBottom: '12px',
                  border: `2px ${selectedExportStructure === 'flat' ? 'solid var(--primary)' : 'solid var(--border)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedExportStructure === 'flat' ? 'var(--primary-light)' : 'var(--bg-light)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    type="radio"
                    name="export-structure"
                    value="flat"
                    checked={selectedExportStructure === 'flat'}
                    onChange={(e) => setSelectedExportStructure(e.target.value)}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Flat Structure</div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                      All PDFs in one folder. Fast export, easy access.
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '4px' }}>
                      📦 candidate_reports/<br/>
                      &nbsp;&nbsp;├─ candidate1.pdf<br/>
                      &nbsp;&nbsp;├─ candidate2.pdf<br/>
                      &nbsp;&nbsp;└─ candidate3.pdf
                    </div>
                  </div>
                </div>
              </div>

              {/* Hierarchical Structure Option */}
              <div
                onClick={() => setSelectedExportStructure('hierarchical')}
                style={{
                  padding: '16px',
                  border: `2px ${selectedExportStructure === 'hierarchical' ? 'solid var(--primary)' : 'solid var(--border)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedExportStructure === 'hierarchical' ? 'var(--primary-light)' : 'var(--bg-light)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <input
                    type="radio"
                    name="export-structure"
                    value="hierarchical"
                    checked={selectedExportStructure === 'hierarchical'}
                    onChange={(e) => setSelectedExportStructure(e.target.value)}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>Organized by Location/District</div>
                    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                      PDFs organized in folders by location or district/centre. Better organization.
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.05)', padding: '8px', borderRadius: '4px' }}>
                      📦 candidate_reports/<br/>
                      &nbsp;&nbsp;├─ Bangalore/<br/>
                      &nbsp;&nbsp;│&nbsp;&nbsp;├─ candidate1.pdf<br/>
                      &nbsp;&nbsp;│&nbsp;&nbsp;└─ candidate2.pdf<br/>
                      &nbsp;&nbsp;└─ Mumbai/<br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└─ candidate3.pdf
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowExportStructureModal(false)}
              >
                Cancel
              </button>
              <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>Export Mode:</label>
                <select value={selectedExportMode} onChange={(e) => setSelectedExportMode(e.target.value)} style={{ padding: '8px 10px', borderRadius: 6 }}>
                  <option value="report">Candidate Reports (PDF)</option>
                  <option value="police_report">Police Reports (PDF)</option>
                  <option value="kyc_report">KYC Reports (PDF)</option>
                  <option value="agreement">Agreement (PDF)</option>
                  <option value="offer_letter">Offer Letter (PDF)</option>
                  <option value="all_images">All Images (Profile + Aadhaar)</option>
                  <option value="profile">Profile Image Only</option>
                  <option value="aadhaar_front">Aadhaar Front Image Only</option>
                  <option value="aadhaar_back">Aadhaar Back Image Only</option>
                  <option value="profile_image_excel">Profile Image Only (Excel)</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmExport}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FontAwesomeIcon icon={selectedExportMode === 'profile_image_excel' ? faFileCsv : faFileArchive} /> {selectedExportMode === 'profile_image_excel' ? 'Export as Excel' : 'Export as ZIP'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showOfferLetterFormModal && (
        <Modal
          isOpen={showOfferLetterFormModal}
          onClose={() => !exportingZip && setShowOfferLetterFormModal(false)}
          title="Offer Letter Details"
          closeOnBackdropClick={!exportingZip}
          maxWidth="900px"
          style={{ zIndex: 9998 }}
        >
          <div style={{ display: 'grid', gap: '12px', padding: '16px 0', maxHeight: '72vh', overflowY: 'auto' }}>
            <div style={{ padding: '12px', background: 'var(--blue-light)', borderRadius: 8, color: 'var(--text2)', fontSize: 13 }}>
              Enter the common project details below. Candidate name and address are populated automatically for each selected candidate.
            </div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Project <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={offerProjectId}
                onChange={async (event) => {
                  const nextProjectId = event.target.value
                  setOfferProjectId(nextProjectId)
                  if (nextProjectId) {
                    await applyProjectTemplate(nextProjectId, 'offer_letter', setOfferLetterFormData)
                  }
                }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, background: '#fff' }}
                disabled={projectTemplateLoading}
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {[
                ['companyName', 'Company Name', 'text', 'CYNOSURE CORPORATE SOLUTIONS'], ['assignmentType', 'Assignment Type', 'text', 'Short-Term Project'], ['projectLocation', 'Project Location', 'text', 'Uttar Pradesh'],
                ['offerDate', 'Offer Date', 'date', 'Select offer date'], ['projectStartDate', 'Project Start Date', 'date', 'Select project start date'], ['projectDuration', 'Project Duration', 'text', 'Till 2nd October 2026'],
                ['reserveDay', 'Reserve Day', 'text', '2nd October 2026'], ['projectReportingTime', 'Project Reporting Time', 'text', '4:00 AM'], ['districtDeployment', 'District Deployment', 'text', 'Any one of the 15 districts in Uttar Pradesh'],
                ['trainingLocation', 'Training Location', 'text', 'Lucknow, Uttar Pradesh'], ['trainingReportingDate', 'Training Reporting Date', 'date', 'Select training reporting date'], ['trainingStartDate', 'Training Start Date', 'date', 'Select training start date'],
                ['trainingReportingTime', 'Training Reporting Time', 'text', '9:00 AM'], ['trainingDuration', 'Training Duration', 'text', '4 days'], ['travelReimbursement', 'Maximum Travel Reimbursement', 'text', '₹1,800'],
                ['foodAllowance', 'Maximum Food Allowance', 'text', '₹400 per day'], ['dinnerAllowance', 'Dinner Allowance', 'text', '₹100 per day'], ['dailyStipend', 'Daily Stipend', 'text', '₹600 per day'],
                ['authorizedSignatoryName', 'Authorized Signatory Name', 'text', 'Enter authorized signatory name'], ['authorizedSignatoryDesignation', 'Authorized Signatory Designation', 'text', 'Enter designation'], ['authorizedSignatoryDate', 'Authorized Signatory Date', 'date', 'Select signatory date'],
              ].map(([field, label, type, placeholder]) => (
                <label key={field} style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                  <span>{label} <span style={{ color: 'red' }}>*</span></span>
                  <input type={type} value={offerLetterFormData[field]} placeholder={placeholder} onChange={(event) => setOfferLetterFormData((current) => ({ ...current, [field]: event.target.value }))} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, fontWeight: 400 }} />
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowOfferLetterFormModal(false)} disabled={exportingZip}>Cancel</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowOfferLetterPreviewModal(true)} disabled={exportingZip}><FontAwesomeIcon icon={faEye} /> Preview Offer Letter</button>
              <button type="button" className="btn btn-primary" onClick={handleOfferLetterFormSubmit} disabled={exportingZip}><FontAwesomeIcon icon={faFileArchive} /> Export Offer Letters</button>
            </div>
          </div>
        </Modal>
      )}

      {showOfferLetterPreviewModal && (
        <Modal isOpen={true} onClose={() => setShowOfferLetterPreviewModal(false)} title="Offer Letter Preview" fullScreen>
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <OfferLetterEditor candidate={offerPreviewCandidate} offerData={offerLetterFormData} editable={false} />
          </div>
        </Modal>
      )}

      {/* Police Report Confirmation Modal */}
      {showPoliceReportConfirmModal && (
        <Modal
          isOpen={showPoliceReportConfirmModal}
          onClose={() => !exportingZip && setShowPoliceReportConfirmModal(false)}
          title="Choose Your Export Format"
          closeOnBackdropClick={false}
          style={{ zIndex: 10000 }}
        >
          <div style={{ padding: '32px 24px', zIndex: 9999 }}>
            <div style={{ marginBottom: '32px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text1)', marginBottom: '8px', textAlign: 'center' }}>
                Select how you want to export the agreement
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>
                Choose between standard 3-page export or include police verification report as page 4
              </div>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '16px',
              marginBottom: '28px'
            }}>
              {/* Option 1: Without Police Report */}
              <div
                onClick={() => !exportingZip && handlePoliceReportConfirmation(false)}
                style={{
                  padding: '20px',
                  border: '2px solid var(--border)',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-light)',
                  cursor: exportingZip ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: exportingZip ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!exportingZip) {
                    e.currentTarget.style.borderColor = 'var(--border-light)'
                    e.currentTarget.style.backgroundColor = '#f9f9f9'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exportingZip) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-light)'
                  }
                }}
              >
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text1)', marginBottom: '4px' }}>
                    Standard Export
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', backgroundColor: 'var(--primary-light)', display: 'inline-block', padding: '4px 8px', borderRadius: '4px' }}>
                    3 Pages
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text3)', lineHeight: 1.5, marginBottom: '12px' }}>
                  <div><strong>Includes:</strong></div>
                  <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text3)' }}>
                    ✓ Agreement (Pages 1-2)<br/>
                    ✓ KYC Report (Page 3)
                  </div>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(100, 150, 200, 0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--text3)' }}>
                  Best for quick agreement signing
                </div>
              </div>

              {/* Option 2: With Police Report */}
              <div
                onClick={() => !exportingZip && handlePoliceReportConfirmation(true)}
                style={{
                  padding: '20px',
                  border: '2px solid var(--primary)',
                  borderRadius: '12px',
                  backgroundColor: 'var(--primary-light)',
                  cursor: exportingZip ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: exportingZip ? 0.6 : 1,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!exportingZip) {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!exportingZip) {
                    e.currentTarget.style.borderColor = 'var(--primary)'
                    e.currentTarget.style.boxShadow = 'none'
                  }
                }}
              >
                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--primary)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  RECOMMENDED
                </div>
                <div style={{ marginBottom: '12px', marginTop: '4px' }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>📋</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
                    Complete Export
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', backgroundColor: 'var(--primary)', display: 'inline-block', padding: '4px 8px', borderRadius: '4px' }}>
                    4 Pages
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5, marginBottom: '12px' }}>
                  <div><strong>Includes:</strong></div>
                  <div style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text2)' }}>
                    ✓ Agreement (Pages 1-2)<br/>
                    ✓ KYC Report (Page 3)<br/>
                    ✓ Police Report (Page 4)
                  </div>
                </div>
                <div style={{ padding: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', borderRadius: '6px', fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>
                  Complete verification documentation
                </div>
              </div>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-light)', 
              padding: '14px 16px', 
              borderRadius: '8px', 
              fontSize: '12px', 
              color: 'var(--text3)',
              marginBottom: '20px',
              borderLeft: '4px solid var(--primary)'
            }}>
              <strong style={{ color: 'var(--primary)' }}>💡 Tip:</strong> Choose "Complete Export" if you need police verification documentation. Choose "Standard Export" for faster generation if you only need agreement and KYC.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowPoliceReportConfirmModal(false)}
                disabled={exportingZip}
              >
                Cancel
              </button>
            </div>

            {exportingZip && (
              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text3)' }}>
                <FontAwesomeIcon icon={faSpinner} spin /> Generating export...
              </div>
            )}
          </div>
        </Modal>
      )}

      <LoadingOverlay active={loading} message="Checking KYC statuses..." />

      {showAgreementFormModal && (
        <Modal
          isOpen={showAgreementFormModal}
          onClose={() => !exportingZip && setShowAgreementFormModal(false)}
          title="Agreement Form Details"
          closeOnBackdropClick={true}
          style={{ zIndex: 9998 }}
        >
          <div style={{ display: 'grid', gap: '12px', padding: '16px 0', maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Project <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                value={agreementProjectId}
                onChange={async (event) => {
                  const nextProjectId = event.target.value
                  setAgreementProjectId(nextProjectId)
                  if (nextProjectId) {
                    await applyProjectTemplate(nextProjectId, 'agreement', setAgreementFormData)
                  }
                }}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px', background: '#fff' }}
                disabled={projectTemplateLoading}
              >
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Date of Agreement <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="date"
                value={agreementFormData.dateOfAgreement}
                onChange={(e) => setAgreementFormData({ ...agreementFormData, dateOfAgreement: e.target.value })}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Recruitment for(e.g., BPSSC JULY 2026) <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={agreementFormData.recruitmentFor}
                onChange={(e) => setAgreementFormData({ ...agreementFormData, recruitmentFor: e.target.value })}
                placeholder="e.g., BPSSC ADVT NO:04/2026"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Number of Venues <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={agreementFormData.numberOfVenues}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, numberOfVenues: e.target.value })}
                  placeholder="e.g., 189"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Centre Code removed from modal; will be taken from candidate API */}
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Project End Date <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="date"
                  value={agreementFormData.projectEndDate}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, projectEndDate: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Reporting Time From <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="time"
                  value={agreementFormData.reportingTimeFrom}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, reportingTimeFrom: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Reporting Time To <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="time"
                  value={agreementFormData.reportingTimeTo}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, reportingTimeTo: e.target.value })}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Witness Name <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={agreementFormData.witnessName}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, witnessName: e.target.value })}
                  placeholder="e.g., John Doe"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  Witness Designation <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={agreementFormData.witnessDesignation}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, witnessDesignation: e.target.value })}
                  placeholder="e.g., Manager / Supervisor"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                  INR per Day <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={agreementFormData.inrPerDay}
                  onChange={(e) => setAgreementFormData({ ...agreementFormData, inrPerDay: e.target.value })}
                  placeholder="e.g., 500"
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Governing State <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={agreementFormData.governingState}
                onChange={(e) => setAgreementFormData({ ...agreementFormData, governingState: e.target.value })}
                placeholder="e.g., Telangana"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Conducted By (Patna Govt)
              </label>
              <input
                type="text"
                value={agreementFormData.recruitmentInfo}
                onChange={(e) => setAgreementFormData({ ...agreementFormData, recruitmentInfo: e.target.value })}
                placeholder="e.g., BPSSC ADVT NO:04/2026"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Company Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                value={agreementFormData.companyConsent}
                onChange={(e) => setAgreementFormData({ ...agreementFormData, companyConsent: e.target.value })}
                placeholder="e.g., CYNOSURE CORPORATE SOLUTIONS"
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '14px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowAgreementFormModal(false)}
                disabled={exportingZip}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAgreementFormSubmit}
                disabled={exportingZip}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {exportingZip ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin /> Exporting...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faFileArchive} /> Export Agreements
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
