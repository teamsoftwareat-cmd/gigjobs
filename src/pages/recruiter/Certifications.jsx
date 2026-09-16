import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import FileUpload from '../../components/ui/FileUpload'
import * as XLSX from 'xlsx'
import { recruiterAPI } from '../../api/axios'
import { Modal } from '../../components/ui/Modal'
import Select from 'react-select'
import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

const removeWhiteBackground = (imageUrl) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)

        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        for (let index = 0; index < pixels.length; index += 4) {
            const red = pixels[index]
            const green = pixels[index + 1]
            const blue = pixels[index + 2]
            const whiteness = Math.min(red, green, blue)

            if (whiteness >= 245) {
                pixels[index + 3] = 0
            } else if (whiteness >= 220) {
                pixels[index + 3] = Math.round((245 - whiteness) * 4)
            }
        }

        context.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = reject
    image.src = imageUrl
})

function Certifications() {
    const navigate = useNavigate()
    const location = useLocation()
    const generateSampleWorkbook = () => {
        const sampleRows = [
            {
                Name: 'Anita Sharma',
                Mobile: '9876543210',
                Aadhaar: '123456789012',
                Designation: 'Operator',
                Project: 'CSBC Patna',
                Venue: 'Patna',
                IssueDate: '2026-09-04'
            },
            {
                Name: 'Ravi Kumar',
                Mobile: '9123456780',
                Aadhaar: '234567890123',
                Designation: 'Technician',
                Project: 'RRC Chennai',
                Venue: 'Delhi',
                IssueDate: '2026-09-04'
            }
        ]

        const worksheet = XLSX.utils.json_to_sheet(sampleRows)
        const workbook = XLSX.utils.book_new()

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates')

        const excelBuffer = XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        })

        const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        })

        const downloadUrl = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = downloadUrl
        link.download = 'certificate_candidates_sample.xlsx'

        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(downloadUrl)
    }

    const [selectedFiles, setSelectedFiles] = useState([])
    const [parsedRows, setParsedRows] = useState([])
    const [eligibleCandidates, setEligibleCandidates] = useState([])
    const [excludedCandidates, setExcludedCandidates] = useState([])
    const [selectedCandidateIds, setSelectedCandidateIds] = useState(new Set())
    const [projects, setProjects] = useState([])
    const [selectedProjectId, setSelectedProjectId] = useState('')

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [historyRecords, setHistoryRecords] = useState([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState('')
    const [historySearch, setHistorySearch] = useState('')
    const [historyMobile, setHistoryMobile] = useState('')
    const [historyAadhaar, setHistoryAadhaar] = useState('')
    const [historyDateFrom, setHistoryDateFrom] = useState('')
    const [historyDateTo, setHistoryDateTo] = useState('')
    const [historyOffset, setHistoryOffset] = useState(0)
    const [historyLimit, setHistoryLimit] = useState(10)
    const [historyTotal, setHistoryTotal] = useState(0)
    const [selectedHistoryIds, setSelectedHistoryIds] = useState(new Set())
    const [historyDownloadingId, setHistoryDownloadingId] = useState('')

    useEffect(() => {
        let active = true

        recruiterAPI.getProjects({ limit: 1000 })
            .then((response) => {
                const data = response.data?.data || response.data || {}
                const items = Array.isArray(data)
                    ? data
                    : data.items || data.projects || []

                if (active) setProjects(items)
            })
            .catch((error) => {
                console.error('Error loading projects:', error)
                if (active) setProjects([])
            })

        return () => {
            active = false
        }
    }, [])

    const loadCertificateHistory = async (nextOffset = 0) => {
        setHistoryLoading(true)
        setHistoryError('')

        try {
            const response = await recruiterAPI.getCertificateHistory({
                offset: nextOffset,
                limit: historyLimit,
                ...(selectedProjectId && { project_id: selectedProjectId }),
                ...(historySearch && { candidate_name: historySearch }),
                ...(historyMobile && { candidate_mobile: historyMobile }),
                ...(historyAadhaar && { aadhaar_number: historyAadhaar }),
                ...(historyDateFrom && { date_from: historyDateFrom }),
                ...(historyDateTo && { date_to: historyDateTo }),
            })

            const payload = response?.data?.data || response?.data || {}
            const items = Array.isArray(payload)
                ? payload
                : payload.items || payload.records || payload.history || []

            setHistoryRecords(items)
            setHistoryTotal(payload.total ?? payload.count ?? items.length)
            setHistoryOffset(nextOffset)
        } catch (error) {
            setHistoryRecords([])
            setHistoryTotal(0)
            setHistoryError(error?.message || 'Unable to load certificate history.')
        } finally {
            setHistoryLoading(false)
        }
    }

    const openCertificateHistory = () => {
        setIsHistoryOpen(true)
        loadCertificateHistory(0)
    }

    const getHistoryValue = (record, ...keys) => {
        for (const key of keys) {
            if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key]
        }
        return ''
    }

    const formatHistoryDate = (value) => {
        if (!value) return '-'
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
    }

    const toggleHistorySelection = (record) => {
        const recordId = String(getHistoryValue(record, 'id', 'certificate_id', 'import_id'))
        const next = new Set(selectedHistoryIds)
        if (next.has(recordId)) next.delete(recordId)
        else next.add(recordId)
        setSelectedHistoryIds(next)
    }

    const normalizeCertificateResponse = (payload) => {
        const normalizeCandidate = (candidate) => {
            const source = candidate?.candidate || candidate?.candidate_data || candidate || {}
            return {
                ...source,
                Name: source.Name || source.name || source.full_name || '',
                Mobile: source.Mobile || source.mobile || source.phone || '',
                Aadhaar: source.Aadhaar || source.aadhaar || source.aadhaar_number || '',
                Designation: source.Designation || source.designation || '',
                Project: source.Project || source.project || source.project_name || '',
                Venue: source.Venue || source.venue || source.location || '',
                IssueDate: source.IssueDate || source.issue_date || source.date || '',
            }
        }

        const body = payload?.data || payload || {}
        const registered = body.registered || body.registered_candidates || body.eligible || body.eligible_candidates
        const excluded = body.not_registered || body.notRegistered || body.not_registered_candidates || body.unregistered || body.excluded || body.excluded_candidates

        if (Array.isArray(registered) || Array.isArray(excluded)) {
            return {
                registered: Array.isArray(registered) ? registered.map(normalizeCandidate) : [],
                excluded: Array.isArray(excluded) ? excluded.map(normalizeCandidate) : [],
            }
        }

        const candidates = Array.isArray(body) ? body : body.candidates || body.records || body.items || []
        return candidates.reduce((result, candidate) => {
            const status = String(candidate.status || candidate.registration_status || '').toLowerCase().replace(/[ -]/g, '_')
            if (['registered', 'eligible', 'approved'].includes(status)) result.registered.push(normalizeCandidate(candidate))
            else result.excluded.push(normalizeCandidate(candidate))
            return result
        }, {
            registered: Array.isArray(registered) ? registered.map(normalizeCandidate) : [],
            excluded: Array.isArray(excluded) ? excluded.map(normalizeCandidate) : [],
        })
    }

    const handleFileUpload = async () => {
        const file = selectedFiles[0]
        if (!file) {
            alert('Please select a file to upload.')
            return
        }
        if (!selectedProjectId) {
            alert('Please select a project.')
            return
        }
        const fileBuffer = await file.arrayBuffer()

        const workbook = XLSX.read(fileBuffer, {
            type: 'array',
            raw: false
        })

        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        const rows = XLSX.utils.sheet_to_json(worksheet, {
            defval: ''
        })

        console.log('Parsed spreadsheet rows:', rows)

        setParsedRows(rows)

        if(rows.length > 0) {
            try {
                const selectedProject = projects.find((project) => String(
                    project.id ?? project.project_id ?? project.projectId
                ) === String(selectedProjectId))

                const response = await recruiterAPI.postCertificates({
                    project_id: selectedProjectId,
                    project_name: selectedProject?.name || selectedProject?.projectName || selectedProject?.project_name || selectedProject?.title || selectedProject?.project_title || selectedProject?.label || selectedProject?.project || '',
                    rows
                })

                const result = normalizeCertificateResponse(response.data)
                setEligibleCandidates(result.registered)
                setExcludedCandidates(result.excluded)
                setParsedRows(result.registered)
                setSelectedCandidateIds(new Set(result.registered.map((candidate, index) => String(candidate.id || candidate.candidate_id || candidate.Mobile || candidate.Aadhaar || index))))
                setPendingTemplate(null)
            } catch (error) {
                console.error('Error uploading certifications:', error)
                setEligibleCandidates([])
            }
        }
    }

    const templates = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'Traditional blue certificate',
        theme: 'appreciation'
    },
    {
        id: 'modern',
        name: 'Modern',
        description: 'Minimal green certificate',
        theme: 'achievement'
    },
    {
        id: 'professional',
        name: 'Professional',
        description: 'Formal dark certificate',
        theme: 'completion'
    }
]

    const [pendingTemplate, setPendingTemplate] = useState(null)
    const [selectedTemplate, setSelectedTemplate] = useState(null)

    useEffect(() => {
        const historyRecord = location.state?.rerenderCertificate
        if (!historyRecord) return

        const source = historyRecord.candidate || historyRecord.candidate_data || {}
        const candidate = {
            ...source,
            Name: historyRecord.candidate_name || historyRecord.candidateName || historyRecord.name || source.Name || source.name || '',
            Mobile: historyRecord.mobile || historyRecord.candidate_mobile || source.Mobile || source.mobile || '',
            Aadhaar: historyRecord.aadhaar_number || historyRecord.aadhaar || source.Aadhaar || source.aadhaar || '',
            Designation: historyRecord.designation || historyRecord.candidate_designation || source.Designation || source.designation || '',
            Project: historyRecord.project_name || historyRecord.projectName || source.Project || source.project || '',
            Venue: historyRecord.venue || historyRecord.location || source.Venue || source.venue || source.location || '',
            IssueDate: historyRecord.issue_date || historyRecord.issueDate || historyRecord.date || source.IssueDate || source.issue_date || '',
        }

        setSelectedProjectId(String(historyRecord.project_id || historyRecord.projectId || ''))
        setEligibleCandidates([candidate])
        setExcludedCandidates([])
        setSelectedCandidateIds(new Set([getCandidateSelectionId(candidate, 0)]))
        setPendingTemplate(null)
        setIsModalOpen(true)
        navigate(location.pathname, { replace: true, state: {} })
    }, [location.pathname, location.state, navigate])

    const projectOptions = projects
        .map((project) => {
            const value = project.id ?? project.project_id ?? project.projectId ?? project.value
            const label = project.name || project.projectName || project.project_name || project.title || project.project_title || project.label || project.project

            return {
                value: value == null ? '' : String(value),
                label: label ? String(label) : `Project ${value ?? ''}`
            }
        })
        .filter((option) => option.value)

    const getCandidateSelectionId = (candidate, index) => String(candidate.id || candidate.candidate_id || candidate.Mobile || candidate.Aadhaar || index)

    const toggleCandidateSelection = (candidate, index) => {
        const candidateId = getCandidateSelectionId(candidate, index)
        const next = new Set(selectedCandidateIds)
        if (next.has(candidateId)) next.delete(candidateId)
        else next.add(candidateId)
        setSelectedCandidateIds(next)
    }

    const allCandidatesSelected = eligibleCandidates.length > 0
        && selectedCandidateIds.size === eligibleCandidates.length

    const toggleAllCandidateSelection = (shouldSelectAll) => {
        if (!shouldSelectAll) {
            setSelectedCandidateIds(new Set())
            return
        }

        setSelectedCandidateIds(new Set(
            eligibleCandidates.map((candidate, index) => getCandidateSelectionId(candidate, index))
        ))
    }

    const openTemplateModalForSelected = () => {
        if (selectedCandidateIds.size === 0) return
        setPendingTemplate(null)
        setIsModalOpen(true)
    }

const handleTemplateSelect = async (template) => {
    console.log('Selected template:', template)

    setSelectedTemplate(template)

    const selectedCandidates = eligibleCandidates.filter((candidate, index) =>
        selectedCandidateIds.has(getCandidateSelectionId(candidate, index))
    )

    await exportCertificates(template, selectedCandidates)
}

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

    const certificateLogoUrl = `${import.meta.env.BASE_URL}cyno-logo.png`
    const certificateQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent('https://cynosurejobs.net/')}`
    const companyName = 'Cynosure Corporate Solutions'
    const ceoName = 'Vijay Venkatesh'
    const ceoRole = 'CEO'
    const [logoDataUrl, setLogoDataUrl] = useState(certificateLogoUrl)

    useEffect(() => {
        let active = true

        fetch(certificateLogoUrl)
            .then((response) => response.blob())
            .then((blob) => new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.onerror = reject
                reader.readAsDataURL(blob)
            }))
            .then((dataUrl) => removeWhiteBackground(dataUrl))
            .then((transparentDataUrl) => {
                if (active) setLogoDataUrl(transparentDataUrl)
            })
            .catch(() => {})

        return () => {
            active = false
        }
    }, [])

    const formatCertificateMonthYear = (value) => {
        const parsedDate = new Date(value)
        if (Number.isNaN(parsedDate.getTime())) return escapeHtml(value || 'the internship period')
        return parsedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    const renderCertificateMarkup = (template, candidate, candidateIndex, assets = {}) => {
        const name = escapeHtml(candidate.Name || 'Candidate Name')
        const designation = escapeHtml(candidate.Designation || 'Team Member')
        const project = escapeHtml(candidate.Project || 'Project')
        const venue = escapeHtml(candidate.Venue || 'Location')
        const issueMonthYear = escapeHtml(formatCertificateMonthYear(candidate.IssueDate))
        const logoHref = escapeHtml(assets.logoUrl || certificateLogoUrl)
        const qrHref = escapeHtml(assets.qrUrl || certificateQrUrl)

        const svgStart = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1123" height="794" viewBox="0 0 1123 794">'
        const svgEnd = '</svg>'

        if (template.theme === 'appreciation') {
            return `${svgStart}
                <rect width="1123" height="794" fill="#ffffff"/>
                <rect x="18" y="18" width="1087" height="758" rx="3" fill="none" stroke="#173b7a" stroke-width="24"/>
                <rect x="54" y="54" width="1015" height="686" fill="none" stroke="#173b7a" stroke-width="3"/>
                <rect x="76" y="76" width="971" height="642" fill="none" stroke="#9aa0aa" stroke-width="2" stroke-dasharray="8 8"/>
                <image href="${logoHref}" xlink:href="${logoHref}" x="466" y="82" width="190" height="92" preserveAspectRatio="xMidYMid meet"/>
                <text x="561.5" y="218" text-anchor="middle" fill="#173b7a" font-family="Georgia,serif" font-size="62" font-weight="700" letter-spacing="12">CERTIFICATE</text>
                <text x="561.5" y="260" text-anchor="middle" fill="#222" font-family="Georgia,serif" font-size="24" font-weight="700" letter-spacing="7">OF INTERNSHIP</text>
                <text x="561.5" y="326" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="17">This certificate is proudly presented to</text>
                <text x="561.5" y="394" text-anchor="middle" fill="#173b7a" font-family="Georgia,serif" font-size="57" font-style="italic">${name}</text>
                <line x1="300" y1="415" x2="823" y2="415" stroke="#c79a3b" stroke-width="2"/>
                <text x="561.5" y="450" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="15">He has demonstrated commendable dedication, professionalism and skill in carrying out</text>
                <text x="561.5" y="476" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="15">his responsibilities. His performance as <tspan font-weight="700">${designation.toUpperCase()}</tspan> throughout the internship period</text>
                <text x="561.5" y="502" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="15">from ${issueMonthYear} has been satisfactory and we are proud to have him as part of our team.</text>
                <text x="561.5" y="528" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="14">Project: ${project}  |  Venue: ${venue}</text>
                <image href="${qrHref}" x="910" y="570" width="78" height="78" preserveAspectRatio="xMidYMid meet"/>
                <text x="949" y="667" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="10">Scan to visit</text>
                <text x="949" y="681" text-anchor="middle" fill="#173b7a" font-family="Arial,sans-serif" font-size="10">cynosurejobs.net</text>
                <line x1="475" y1="632" x2="650" y2="632" stroke="#222" stroke-width="1"/>
                <text x="562" y="657" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="13" font-weight="700">${ceoName}</text>
                <text x="562" y="675" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="12">${ceoRole}</text>
            ${svgEnd}`
        }

        if (template.theme === 'achievement') {
            return `${svgStart}
                <defs>
                    <linearGradient id="achievementGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2bd63"/><stop offset="1" stop-color="#a87920"/></linearGradient>
                    <linearGradient id="achievementBlue" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b2456"/><stop offset="1" stop-color="#173b7a"/></linearGradient>
                </defs>
                <rect width="1123" height="794" fill="#f8fafc"/>
                <path d="M0 0H258L188 397L258 794H0Z" fill="url(#achievementBlue)"/>
                <path d="M0 0H196L137 397L196 794H0Z" fill="url(#achievementGold)" opacity=".95"/>
                <path d="M1000 0h123v794h-123l70-397z" fill="#0b2456" opacity=".08"/>
                <text x="72" y="395" transform="rotate(-90 72 395)" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-size="17" font-weight="700" letter-spacing="6">CYNOSUREJOBS</text>
                <image href="${logoHref}" xlink:href="${logoHref}" x="575" y="72" width="190" height="92" preserveAspectRatio="xMidYMid meet"/>
                <text x="670" y="222" text-anchor="middle" fill="#102b63" font-family="Arial,sans-serif" font-size="67" font-weight="700" letter-spacing="11">CERTIFICATE</text>
                <rect x="523" y="250" width="294" height="48" rx="24" fill="none" stroke="#c79a3b" stroke-width="2"/>
                <text x="670" y="281" text-anchor="middle" fill="#8b641d" font-family="Arial,sans-serif" font-size="16" font-weight="700" letter-spacing="4">OF ACHIEVEMENT</text>
                <text x="670" y="354" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="19">This certificate is proudly presented to</text>
                <text x="670" y="440" text-anchor="middle" fill="#173b7a" font-family="Georgia,serif" font-size="58" font-style="italic">${name}</text>
                <line x1="385" y1="463" x2="955" y2="463" stroke="#c79a3b" stroke-width="2"/>
                <text x="670" y="496" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="14">He has demonstrated commendable dedication, professionalism and skill in carrying out</text>
                <text x="670" y="518" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="14">his responsibilities. His performance as <tspan font-weight="700">${designation.toUpperCase()}</tspan> throughout the internship period</text>
                <text x="670" y="540" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="14">from ${issueMonthYear} has been satisfactory and we are proud to have him as part of our team.</text>
                <text x="670" y="566" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="14">${project}  |  ${venue}</text>
                <image href="${qrHref}" x="930" y="606" width="70" height="70" preserveAspectRatio="xMidYMid meet"/>
                <line x1="575" y1="640" x2="765" y2="640" stroke="#222" stroke-width="1"/>
                <text x="670" y="662" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="13" font-weight="700">${ceoName}</text>
                <text x="670" y="680" text-anchor="middle" fill="#222" font-family="Arial,sans-serif" font-size="12">${ceoRole}</text>
            ${svgEnd}`
        }

        return `${svgStart}
            <defs><linearGradient id="completionGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3bd65"/><stop offset="1" stop-color="#b17c1e"/></linearGradient></defs>
            <rect width="1123" height="794" fill="#fffdf8"/>
            <rect x="24" y="24" width="1075" height="746" fill="none" stroke="url(#completionGold)" stroke-width="6"/>
            <rect x="42" y="42" width="1039" height="710" fill="none" stroke="#c79a3b" stroke-width="2"/>
            <rect x="58" y="58" width="1007" height="678" fill="none" stroke="#dfbd73" stroke-width="1"/>
            <image href="${logoHref}" xlink:href="${logoHref}" x="481" y="68" width="160" height="76" preserveAspectRatio="xMidYMid meet"/>
            <text x="561.5" y="210" text-anchor="middle" fill="#303030" font-family="Georgia,serif" font-size="67" letter-spacing="13">CERTIFICATE</text>
            <text x="561.5" y="258" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="8">OF COMPLETION</text>
            <text x="561.5" y="330" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="19">This certificate is given to</text>
            <text x="561.5" y="414" text-anchor="middle" fill="#303030" font-family="Georgia,serif" font-size="57">${name}</text>
            <line x1="280" y1="438" x2="843" y2="438" stroke="#c79a3b" stroke-width="2"/>
            <text x="561.5" y="480" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="14">He has demonstrated commendable dedication, professionalism and skill in carrying out</text>
            <text x="561.5" y="502" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="14">his responsibilities. His performance as <tspan font-weight="700">${designation.toUpperCase()}</tspan> throughout the internship period</text>
            <text x="561.5" y="524" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="14">from ${issueMonthYear} has been satisfactory and we are proud to have him as part of our team.</text>
            <text x="561.5" y="550" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="14">${project} - ${venue}</text>
            <g opacity="0.82">
                <circle cx="225" cy="646" r="36" fill="url(#completionGold)"/><circle cx="225" cy="646" r="27" fill="#fffdf8" stroke="#b17c1e" stroke-width="2"/>
                <text x="225" y="657" text-anchor="middle" fill="#b17c1e" font-family="Georgia,serif" font-size="30">★</text>
            </g>
            <image href="${qrHref}" x="930" y="604" width="78" height="78" preserveAspectRatio="xMidYMid meet"/>
            <line x1="470" y1="646" x2="660" y2="646" stroke="#303030" stroke-width="1"/>
            <text x="565" y="668" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="13" font-weight="700">${ceoName}</text>
            <text x="565" y="686" text-anchor="middle" fill="#303030" font-family="Arial,sans-serif" font-size="12">${ceoRole}</text>
        ${svgEnd}`
    }

    const createCertificateImage = async (template, candidate, candidateIndex) => {
        await document.fonts?.ready

        let qrDataUrl = certificateQrUrl
        let logoDataUrl = certificateLogoUrl

        try {
            const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => resolve(reader.result)
                reader.onerror = reject
                reader.readAsDataURL(blob)
            })

            const [qrResponse, logoResponse] = await Promise.all([
                fetch(certificateQrUrl),
                fetch(certificateLogoUrl)
            ])

            if (qrResponse.ok) qrDataUrl = await blobToDataUrl(await qrResponse.blob())
            if (logoResponse.ok) {
                const rawLogoDataUrl = await blobToDataUrl(await logoResponse.blob())
                logoDataUrl = await removeWhiteBackground(rawLogoDataUrl)
            }
        } catch (error) {
            console.warn('Certificate imagery could not be fully embedded; using source URLs directly.', error)
        }

        const svgMarkup = renderCertificateMarkup(template, candidate, candidateIndex, {
            qrUrl: qrDataUrl,
            logoUrl: logoDataUrl
        })
        const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)

        try {
            const image = await new Promise((resolve, reject) => {
                const nextImage = new Image()
                nextImage.onload = () => resolve(nextImage)
                nextImage.onerror = () => reject(new Error('Unable to render certificate SVG'))
                nextImage.src = svgUrl
            })

            const canvas = document.createElement('canvas')
            canvas.width = 2246
            canvas.height = 1588

            const context = canvas.getContext('2d')
            context.fillStyle = '#ffffff'
            context.fillRect(0, 0, canvas.width, canvas.height)
            context.drawImage(image, 0, 0, canvas.width, canvas.height)

            return canvas.toDataURL('image/jpeg', 0.98)
        } finally {
            URL.revokeObjectURL(svgUrl)
        }
    }

    const exportCertificates = async (template, candidates) => {
        const zip = new JSZip()
        const exportedCandidates = []

        for (const [index, candidate] of candidates.entries()) {
            const certificateImage = await createCertificateImage(template, candidate, index)
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
            pdf.addImage(certificateImage, 'JPEG', 0, 0, 297, 210, undefined, 'FAST')

            const safeName = String(candidate.Name || `candidate-${index + 1}`)
                .replace(/[^a-z0-9]/gi, '_')

            const fileName = `${safeName}_certificate.pdf`
            zip.file(fileName, pdf.output('arraybuffer'))
            exportedCandidates.push({
                ...candidate,
                certificate_file_name: fileName,
            })
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `${template.id}_certificates.zip`)

        await recruiterAPI.postCertificateHistory({
            project_id: selectedProjectId,
            template_id: template.id,
            template_name: template.name,
            candidates: exportedCandidates,
        })
    }

    const getTemplateForHistoryRecord = (record) => {
        const templateId = getHistoryValue(record, 'template_id', 'templateId')
        return templates.find((template) => template.id === templateId) || templates[0]
    }

    const downloadHistoryCertificate = async (record, recordId) => {
        setHistoryDownloadingId(recordId)

        try {
            const candidate = {
                ...(record.candidate || record.candidate_data || {}),
                Name: getHistoryValue(record, 'candidate_name', 'candidateName', 'name') || record.candidate?.Name || record.candidate?.name || '',
                Mobile: getHistoryValue(record, 'mobile', 'candidate_mobile', 'candidateMobile') || record.candidate?.Mobile || record.candidate?.mobile || '',
                Aadhaar: getHistoryValue(record, 'aadhaar', 'aadhaar_number', 'aadhaarNumber') || record.candidate?.Aadhaar || record.candidate?.aadhaar || '',
                Designation: getHistoryValue(record, 'designation', 'candidate_designation') || record.candidate?.Designation || record.candidate?.designation || '',
                Project: getHistoryValue(record, 'project_name', 'projectName') || record.candidate?.Project || record.candidate?.project || '',
                Venue: getHistoryValue(record, 'venue', 'location') || record.candidate?.Venue || record.candidate?.venue || '',
                IssueDate: getHistoryValue(record, 'issue_date', 'issueDate', 'date') || record.candidate?.IssueDate || record.candidate?.issue_date || '',
            }

            const certificateImage = await createCertificateImage(getTemplateForHistoryRecord(record), candidate, 0)
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
            pdf.addImage(certificateImage, 'JPEG', 0, 0, 297, 210, undefined, 'FAST')

            const safeName = String(candidate.Name || `candidate-${recordId}`)
                .replace(/[^a-z0-9]/gi, '_')
            const blob = pdf.output('blob')
            saveAs(blob, `${safeName}_certificate.pdf`)
        } catch (error) {
            console.error('Error rebuilding certificate from history:', error)
            alert('Unable to rebuild this certificate.')
        } finally {
            setHistoryDownloadingId('')
        }
    }

    return (
        <>
        <div className="flex flex-col justify-center min-h-screen bg-gray-100 outerDiv" style={{ flexDirection: 'column' }}>
            <h4 className="text-3xl font-bold mb-6" style={{ marginBottom: '16px' }}>Certifications</h4>
            <div>
            <label htmlFor="certificate-project" style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                Select project
            </label>
            <Select
                inputId="certificate-project"
                options={projectOptions}
                value={projectOptions.find((option) => option.value === String(selectedProjectId)) || null}
                onChange={(option) => setSelectedProjectId(option?.value || '')}
                placeholder="Search and choose a project"
                isSearchable
                isClearable
                noOptionsMessage={() => 'No projects found'}
                styles={{ container: (base) => ({ ...base, marginBottom: 16 }) }}
            />
            <FileUpload 
            accept=".xls,.xlsx, .csv"
            placeholder="Upload your files"
            multiple={false}
            onFilesChange={(files) => {
                setSelectedFiles(files)
            }}
            />
            <div className="flex flex-col gap-4" style={{ marginTop: '16px', width: 'fitContent', display: 'flex', gap: '16px' }}>
            <button className="btn btn-secondary" onClick={generateSampleWorkbook}>
                Download sample file
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/app/recruiter/document-history?type=certificate')}>
                Certificate history
            </button>
            <button className="btn btn-primary uploadSheetBtn" style={{ marginTop: '16px !important', width: '100%'}} onClick={handleFileUpload} disabled={selectedFiles.length === 0 || !selectedProjectId}>
                Upload file
            </button>
            </div>
            </div>
        </div>

        {eligibleCandidates.length > 0 && (
            <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h5 style={{ margin: 0 }}>Registered candidates</h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span>{selectedCandidateIds.size} selected for export</span>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={openTemplateModalForSelected}
                            disabled={selectedCandidateIds.size === 0}
                        >
                            Export selected certificates
                        </button>
                    </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: 8 }}>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                        <input
                                            type="checkbox"
                                            checked={allCandidatesSelected}
                                            onChange={(event) => toggleAllCandidateSelection(event.target.checked)}
                                        />
                                        Select all
                                    </label>
                                </th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Mobile</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Aadhaar</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Designation</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eligibleCandidates.map((candidate, index) => {
                                const candidateId = getCandidateSelectionId(candidate, index)
                                return (
                                    <tr key={candidateId} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedCandidateIds.has(candidateId)}
                                                onChange={() => toggleCandidateSelection(candidate, index)}
                                            />
                                        </td>
                                        <td style={{ padding: 8 }}>{candidate.Name || '-'}</td>
                                        <td style={{ padding: 8 }}>{candidate.Mobile || '-'}</td>
                                        <td style={{ padding: 8 }}>{candidate.Aadhaar || '-'}</td>
                                        <td style={{ padding: 8 }}>{candidate.Designation || '-'}</td>
                                        <td style={{ padding: 8 }}>{candidate.status || 'Registered'}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {excludedCandidates.length > 0 && (
            <div style={{ marginTop: 20, padding: 16, border: '1px solid #f0b4b4', borderRadius: 8, background: '#fff7f7' }}>
                <h5 style={{ marginTop: 0 }}>Excluded candidates ({excludedCandidates.length})</h5>
                <p style={{ marginTop: 0 }}>These candidates were not registered and will not receive certificates.</p>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Mobile</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Aadhaar</th>
                                <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {excludedCandidates.map((candidate, index) => (
                                <tr key={`${candidate.Name}-${index}`} style={{ borderTop: '1px solid #f0d2d2' }}>
                                    <td style={{ padding: 8 }}>{candidate.Name || '-'}</td>
                                    <td style={{ padding: 8 }}>{candidate.Mobile || '-'}</td>
                                    <td style={{ padding: 8 }}>{candidate.Aadhaar || '-'}</td>
                                    <td style={{ padding: 8 }}>{candidate.status || candidate.registration_status || 'Not registered'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            title={eligibleCandidates.length > 0 ? 'Choose a certificate template' : 'No certificates available'}
            maxWidth="1000px"
        >
            {eligibleCandidates.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                    <h4 style={{ margin: '0 0 8px', color: 'var(--text)' }}>No registered candidates found</h4>
                    <p style={{ margin: '0 0 20px', color: 'var(--text2)' }}>
                        No certificates can be generated because none of the uploaded candidates are registered.
                    </p>
                    <button className="btn btn-outline" onClick={() => setIsModalOpen(false)}>
                        Close
                    </button>
                </div>
            )}
            {eligibleCandidates.length > 0 && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                        {templates.map((template) => (
                        <div
                            key={template.id}
                            onClick={() => setPendingTemplate(template)}
                            style={{
                                minWidth: 0,
                                border: pendingTemplate?.id === template.id ? '2px solid var(--teal)' : '1px solid var(--border)',
                                borderRadius: '8px',
                                padding: '16px',
                                cursor: 'pointer',
                                background: 'var(--bg)'
                            }}
                        >
                            <div style={{ position: 'relative', height: '180px', overflow: 'hidden', marginBottom: '12px', background: '#fff' }}>
                                <div
                                    style={{ position: 'absolute', top: 0, left: 0, width: '1123px', height: '794px', transform: 'scale(0.255)', transformOrigin: 'top left', pointerEvents: 'none' }}
                                    dangerouslySetInnerHTML={{
                                        __html: renderCertificateMarkup(template, { Name: 'Candidate Name', Designation: 'Team Member', Project: 'Project', Venue: 'Location', IssueDate: '2026-09-04' }, 0, { logoUrl: logoDataUrl })
                                    }}
                                />
                            </div>

                            <h5>{template.name}</h5>
                            <p>{template.description}</p>
                        </div>
                        ))}
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleTemplateSelect(pendingTemplate)}
                        disabled={!pendingTemplate || selectedCandidateIds.size === 0}
                        style={{ marginTop: '20px', width: '100%' }}
                    >
                        Select template
                    </button>
                </>
            )}
        </Modal>

        <Modal
            isOpen={isHistoryOpen}
            onClose={() => setIsHistoryOpen(false)}
            title="Certificate history"
            maxWidth="1200px"
        >
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
                <div>
                    <label htmlFor="certificate-history-search" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Candidate</label>
                    <input
                        id="certificate-history-search"
                        className="form-control"
                        placeholder="Search candidate name"
                        value={historySearch}
                        onChange={(event) => setHistorySearch(event.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="certificate-history-mobile" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Mobile</label>
                    <input
                        id="certificate-history-mobile"
                        className="form-control"
                        placeholder="Search mobile number"
                        value={historyMobile}
                        onChange={(event) => setHistoryMobile(event.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="certificate-history-aadhaar" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Aadhaar</label>
                    <input
                        id="certificate-history-aadhaar"
                        className="form-control"
                        placeholder="Search Aadhaar number"
                        value={historyAadhaar}
                        onChange={(event) => setHistoryAadhaar(event.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="certificate-history-from" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>From</label>
                    <input id="certificate-history-from" type="date" className="form-control" value={historyDateFrom} onChange={(event) => setHistoryDateFrom(event.target.value)} />
                </div>
                <div>
                    <label htmlFor="certificate-history-to" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>To</label>
                    <input id="certificate-history-to" type="date" className="form-control" value={historyDateTo} onChange={(event) => setHistoryDateTo(event.target.value)} />
                </div>
                <button className="btn btn-primary" onClick={() => loadCertificateHistory(0)} disabled={historyLoading}>Search</button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--text2)' }}>
                    {selectedHistoryIds.size} selected · {historyTotal} total records
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => {
                        setHistorySearch('')
                        setHistoryMobile('')
                        setHistoryAadhaar('')
                        setHistoryDateFrom('')
                        setHistoryDateTo('')
                        setSelectedHistoryIds(new Set())
                        loadCertificateHistory(0)
                    }}>
                        Clear filters
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => loadCertificateHistory(historyOffset)} disabled={historyLoading}>
                        Refresh
                    </button>
                </div>
            </div>

            {historyError && <div style={{ color: 'var(--red)', marginBottom: 12 }}>{historyError}</div>}

            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
                    <thead>
                        <tr style={{ background: 'var(--surface)' }}>
                            <th style={{ padding: 10, textAlign: 'left' }}>Select</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Candidate</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Mobile</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Aadhaar</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Project</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Template</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Created</th>
                            <th style={{ padding: 10, textAlign: 'left' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historyRecords.map((record, index) => {
                            const recordId = String(getHistoryValue(record, 'id', 'certificate_id', 'import_id') || index)
                            const candidateName = getHistoryValue(record, 'candidate_name', 'candidateName', 'name') || record.candidate?.name || '-'
                            const mobile = getHistoryValue(record, 'mobile', 'candidate_mobile', 'candidateMobile') || record.candidate?.mobile || '-'
                            const aadhaar = getHistoryValue(record, 'aadhaar', 'aadhaar_number', 'aadhaarNumber') || record.candidate?.aadhaar || record.candidate?.aadhaar_number || '-'
                            const projectName = getHistoryValue(record, 'project_name', 'projectName') || '-'
                            const templateName = getHistoryValue(record, 'template_name', 'templateName', 'template_id') || '-'
                            const createdAt = getHistoryValue(record, 'created_at', 'createdAt', 'uploaded_at')

                            return (
                                <tr key={recordId} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: 10 }}><input type="checkbox" checked={selectedHistoryIds.has(recordId)} onChange={() => toggleHistorySelection(record)} /></td>
                                    <td style={{ padding: 10 }}>{candidateName}</td>
                                    <td style={{ padding: 10 }}>{mobile}</td>
                                    <td style={{ padding: 10 }}>{aadhaar}</td>
                                    <td style={{ padding: 10 }}>{projectName}</td>
                                    <td style={{ padding: 10 }}>{templateName}</td>
                                    <td style={{ padding: 10 }}>{formatHistoryDate(createdAt)}</td>
                                    <td style={{ padding: 10 }}>
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={() => downloadHistoryCertificate(record, recordId)}
                                            disabled={historyDownloadingId === recordId}
                                        >
                                            {historyDownloadingId === recordId ? 'Building...' : 'Download'}
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                        {!historyRecords.length && (
                            <tr><td colSpan="8" style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{historyLoading ? 'Loading history...' : 'No certificate history found.'}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <select value={historyLimit} onChange={(event) => { const nextLimit = Number(event.target.value); setHistoryLimit(nextLimit); loadCertificateHistory(0) }} style={{ padding: 8 }}>
                    <option value="10">10 per page</option>
                    <option value="25">25 per page</option>
                    <option value="50">50 per page</option>
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => loadCertificateHistory(Math.max(0, historyOffset - historyLimit))} disabled={historyOffset === 0 || historyLoading}>Previous</button>
                    <button className="btn btn-outline btn-sm" onClick={() => loadCertificateHistory(historyOffset + historyLimit)} disabled={historyOffset + historyLimit >= historyTotal || historyLoading}>Next</button>
                </div>
            </div>
        </Modal>
        </>
    )
}

export default Certifications