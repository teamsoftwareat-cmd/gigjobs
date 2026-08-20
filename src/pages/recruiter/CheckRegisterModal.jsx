import { useState, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTimes, faSpinner, faUpload, faFileExcel, faCheckCircle, faDownload } from '@fortawesome/free-solid-svg-icons'
import { recruiterAPI } from '../../api/axios'
import { Modal, DataTable } from '../../components/ui/index'
import { BIHAR_POLICE_STATIONS } from '../../components/Registration/Step2Profile'
import * as XLSX from 'xlsx'

// Helper function to get police station by pincode
const getPoliceStationByPincode = (pincode) => {
  if (!pincode) return null
  const normalizedPincode = String(pincode).replace(/\D/g, '')
  const matches = BIHAR_POLICE_STATIONS.filter((entry) => String(entry.pincode || '').replace(/\D/g, '') === normalizedPincode)
  return matches.length > 0 ? matches[0].policeStation : null
}

const normalizeCsvHeader = (value = '') => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const parseCsvRow = (line = '') => {
  const values = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

const normalizeValue = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '')

const readDistrictInfoFromCsv = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = (event) => {
    const content = event.target?.result || ''
    const rows = content.split(/\r?\n/).filter((line) => line.trim() !== '')

    if (rows.length === 0) {
      resolve({ hasDistrict: false, lookup: {} })
      return
    }

    const headers = parseCsvRow(rows[0]).map(normalizeCsvHeader)
    const districtIndex = headers.findIndex((header) => header === 'district')
    if (districtIndex === -1) {
      resolve({ hasDistrict: false, lookup: {} })
      return
    }

    const getHeaderIndex = (candidateNames) => {
      for (const name of candidateNames) {
        const index = headers.findIndex((header) => header === normalizeCsvHeader(name))
        if (index !== -1) return index
      }
      return -1
    }

    const candidateNameIndex = getHeaderIndex(['candidate_name', 'name', 'candidate'])
    const candidateMobileIndex = getHeaderIndex(['candidate_mobile_number', 'candidate_mobile', 'mobile_number', 'mobile'])
    const aadhaarIndex = getHeaderIndex(['aadhaar_number', 'aadhaar', 'aadhar_number', 'aadhar'])

    const lookup = {}

    rows.slice(1).forEach((line) => {
      const row = parseCsvRow(line)
      const districtValue = row[districtIndex]?.trim() || ''
      if (!districtValue) return

      const candidateName = row[candidateNameIndex] || ''
      const candidateMobile = row[candidateMobileIndex] || ''
      const aadhaar = row[aadhaarIndex] || ''

      if (candidateMobile) lookup[`mobile:${normalizeValue(candidateMobile)}`] = districtValue
      if (aadhaar) lookup[`aadhaar:${normalizeValue(aadhaar)}`] = districtValue
      if (candidateName) lookup[`name:${normalizeValue(candidateName)}`] = districtValue
    })

    resolve({ hasDistrict: true, lookup })
  }

  reader.onerror = () => resolve({ hasDistrict: false, lookup: {} })
  reader.readAsText(file)
})

export default function CheckRegisterModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [districtColumnPresent, setDistrictColumnPresent] = useState(false)
  const [districtLookup, setDistrictLookup] = useState({})
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop().toLowerCase()
      if (fileExt !== 'csv') {
        setError('Please upload a valid CSV file')
        setFile(null)
        setDistrictColumnPresent(false)
        setDistrictLookup({})
        return
      }

      try {
        const districtInfo = await readDistrictInfoFromCsv(selectedFile)
        setDistrictColumnPresent(districtInfo.hasDistrict)
        setDistrictLookup(districtInfo.lookup)
      } catch (error) {
        setDistrictColumnPresent(false)
        setDistrictLookup({})
      }

      setFile(selectedFile)
      setError('')
      setResults([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file to upload.')
      return
    }

    setLoading(true)
    setError('')
    const formData = new FormData()
    formData.append('file', file)

    try {
      // API call to check registration status
      const response = await recruiterAPI.checkRegistrationStatus(formData)
      const responseData = response.data?.data || response.data || []
      setResults(Array.isArray(responseData) ? responseData : [])
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process the request. Please ensure the file format is correct.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const exportResults = () => {
    if (results.length === 0) return
    const exportRows = results.map((item, idx) => ({
      'S.no': item.s_no || idx + 1,
      'Candidate Name': item.name || item.candidate_name || '',
      'Father Name': item.father_name || item.fatherName || '',
      'DOB': item.dob || '',
      'Mobile Number': item.mobile || item.candidate_mobile_number || '',
      'Aadhar Number': item.aadhaar || item.aadhar_number || '',
      'Address': item.address || item.candidate_address || item.address_line || item.address_line1 || '',
      'Pincode': item.pincode || '',
      'Nearest Police Station': item.nearest_police_station || getPoliceStationByPincode(item.pincode) || '',
      'Registered': (typeof item.is_registered === 'boolean') ? (item.is_registered ? 'Registered' : 'Not Registered') : (item.is_registered ? String(item.is_registered) : 'Not Registered'),
      'KYC Verified': (item.is_kyc_verified ?? item.kyc_verified) ? 'Yes' : 'No',
      'PS Data Filled': (item.is_police_verified ?? item.police_verified) ? 'Yes' : 'No'
    }))
    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Check Results')
    XLSX.writeFile(workbook, `registration_check_${new Date().getTime()}.xlsx`)
  }

  const exportNotRegistered = () => {
    const notRegistered = results.filter(r => !r.is_registered)
    if (notRegistered.length === 0) return
    const reduced = notRegistered.map((r, idx) => ({
      'S.no': r.s_no || idx + 1,
      'Candidate Name': r.candidate_name || r.name || '',
      'Father Name': r.father_name || r.fatherName || '',
      'DOB': r.dob || '',
      'Mobile Number': r.candidate_mobile_number || r.mobile || '',
      'Aadhar Number': r.aadhar_number || r.aadhaar || '',
      'Address': r.address || r.candidate_address || r.address_line || r.address_line1 || '',
      'Pincode': r.pincode || '',
      'Nearest Police Station': r.nearest_police_station || getPoliceStationByPincode(r.pincode) || '',
      'KYC Verified': (r.is_kyc_verified ?? r.kyc_verified) ? 'Yes' : 'No',
      'PS Data Filled': (r.is_police_verified ?? r.police_verified) ? 'Yes' : 'No'
    }))
    const worksheet = XLSX.utils.json_to_sheet(reduced)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Not Registered')
    XLSX.writeFile(workbook, `registration_not_registered_${new Date().getTime()}.xlsx`)
  }

  const exportForKycLink = () => {
    if (results.length === 0) return

    const exportRows = results.map((item, idx) => {
      const candidateId = item.candidate_id ?? item.candidateId ?? item.id ?? ''
      const kycLink = candidateId ? `https://cynosurejobs.net/gigjobs/#/attendance/kycverify?candidateid=${candidateId}` : ''

      return {
        'S.No': idx + 1,
        'Candidate Name': item.candidate_name || item.name || '',
        'Mobile Number': item.candidate_mobile_number || item.mobile || '',
        'Aadhaar Number': item.aadhar_number || item.aadhaar || '',
        'KYC Link': kycLink,
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'KYC Links')
    XLSX.writeFile(workbook, `kyc_links_${new Date().getTime()}.xlsx`)
  }

  const exportForPoliceStationNames = () => {
    if (results.length === 0) return

    const unverifiedCandidates = results.filter((item) => {
      const status = item.is_police_verified ?? item.police_verified
      return status === false || status === 'false' || status === 'False' || status === 0 || status === '0'
    })

    if (unverifiedCandidates.length === 0) return

    const getDistrictForItem = (item) => {
      if (!districtColumnPresent) return ''

      const mobile = normalizeValue(item.candidate_mobile_number || item.mobile || '')
      const aadhaar = normalizeValue(item.aadhar_number || item.aadhaar || '')
      const name = normalizeValue(item.candidate_name || item.name || '')

      return districtLookup[`mobile:${mobile}`] || districtLookup[`aadhaar:${aadhaar}`] || districtLookup[`name:${name}`] || ''
    }

    const exportRows = unverifiedCandidates.map((item, idx) => {
      const candidateId = item.candidate_id ?? item.candidateId ?? item.id ?? ''
      const policeInfoLink = candidateId ? `https://cynosurejobs.net/gigjobs/#/attendance/police-info?candidate_id=${candidateId}` : ''

      const row = {
        'S.No': idx + 1,
        'Candidate Name': item.candidate_name || item.name || '',
        'Mobile Number': item.candidate_mobile_number || item.mobile || '',
        'Aadhaar Number': item.aadhar_number || item.aadhaar || '',
        'Police Info Link': policeInfoLink,
      }

      if (districtColumnPresent) {
        row.District = getDistrictForItem(item)
      }

      return row
    })

    const worksheet = XLSX.utils.json_to_sheet(exportRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Police Station Names')
    XLSX.writeFile(workbook, `police_station_names_${new Date().getTime()}.xlsx`)
  }

  const downloadSampleTemplate = () => {
    const headers = [
      'candidate_name',
      'candidate_mobile_number',
      'aadhaar_number'
    ]
    const sampleData = [
      ['Nitesh kumar', '7282807174', '997010237441'],
      ['Ravi Ranjan Kumar', '9661545975', '334521063094']
    ]
    const csvRows = [headers.join(','), ...sampleData.map(row => row.join(','))]
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'candidate_registration_sample.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }



  const columns = [
    'S.no',
    'Candidate Name',
    'Father Name',
    'DOB',
    'Mobile Number',
    'Aadhar Number',
    'Address',
    'Pincode',
    'Nearest Police Station',
    'Registered',
    'KYC Verified',
    'PS Data Filled'
  ]

  const rows = results.map((item, index) => [
    item.s_no || index + 1,
    item.name || item.candidate_name || '—',
    item.father_name || item.fatherName || '—',
    item.dob || '—',
    item.mobile || item.candidate_mobile_number || '—',
    item.aadhaar || item.aadhar_number || '—',
    item.address || item.candidate_address || item.address_line || item.address_line1 || '—',
    item.pincode || '—',
    item.nearest_police_station || getPoliceStationByPincode(item.pincode) || '—',
    (typeof item.is_registered === 'boolean') ? (item.is_registered ? 'Registered' : 'Not Registered') : (item.is_registered ? String(item.is_registered) : 'Not Registered'),
    (item.is_kyc_verified ?? item.kyc_verified) ? 'Yes' : 'No',
    (item.is_police_verified ?? item.police_verified) ? 'Yes' : 'No'
  ])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Check Registration Status"
      maxWidth="1100px"
      footer={
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
        </div>
      }
    >
      <div className="check-register-modal-body">
        <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-light)', borderRadius: 12 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <label className="form-label">Upload CSV with Candidate Info</label>
              <input
                type="file"
                className="form-control"
                accept=".csv"
                onChange={handleFileChange}
                ref={fileInputRef}
              />
              <small className="text-muted mt-1 block">Expected columns: candidate_name, candidate_mobile_number, aadhaar_number</small>
              <div style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={downloadSampleTemplate}>
                  <FontAwesomeIcon icon={faDownload} /> Download Sample Template
                </button>
              </div>

            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !file}
              style={{ minWidth: 150, height: 42 }}
            >
              {loading ? <><FontAwesomeIcon icon={faSpinner} spin /> Processing...</> : <><FontAwesomeIcon icon={faCheckCircle} /> Check Register</>}
            </button>
          </div>
          {error && <div style={{ color: 'var(--red)', marginTop: 10, fontSize: 13 }}>{error}</div>}
        </form>

        {results.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={exportResults}>
              <FontAwesomeIcon icon={faFileExcel} /> Export Results
            </button>
            <button className="btn btn-warning btn-sm" onClick={exportNotRegistered}>
              <FontAwesomeIcon icon={faFileExcel} /> Export Not Registered
            </button>
            <button className="btn btn-info btn-sm" onClick={exportForKycLink}>
              <FontAwesomeIcon icon={faFileExcel} /> Export for KYC Link
            </button>
            <button className="btn btn-info btn-sm" onClick={exportForPoliceStationNames}>
              <FontAwesomeIcon icon={faFileExcel} /> Export for Police Station Names
            </button>
          </div>
        )}

        {results.length > 0 ? (
          <div className="projects-table-wrap">
            <DataTable columns={columns} rows={rows} />
          </div>
        ) : (
          !loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
              <FontAwesomeIcon icon={faFileExcel} size="3x" style={{ marginBottom: 16, opacity: 0.2 }} />
              <p>Upload a file to check candidate registration status across the system.</p>
            </div>
          )
        )}
      </div>
    </Modal>
  )
}