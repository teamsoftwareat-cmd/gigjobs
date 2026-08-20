import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useAuth } from '../../context/AuthContext'
import {
  faSave, faMapMarkerAlt, faPhone, faEnvelope,
  faPencilAlt, faTimes, faCheckCircle, faSpinner,
  faUpload, faUser, faBriefcase, faGraduationCap,
  faFileAlt, faIdCard, faCamera, faDownload, faEye,
  faUniversity, faCreditCard
} from '@fortawesome/free-solid-svg-icons'
import { components } from 'react-select'
import CreatableSelect from 'react-select/creatable'
import MultiSelectDropdown from '../../components/Common/MultiSelectDropdown'
import VerificationBanner from '../../components/Common/VerificationBanner'
import FileUpload from '../../components/ui/FileUpload'
import { LoadingOverlay } from '../../components/ui'
import { candidateAPI } from '../../api/axios'

const CURRENT_STATUSES = ['Student', 'Working', 'Fresher', 'Other']

const AREA_OPTIONS_STATIC = []
const LANGUAGE_OPTIONS_STATIC = ['Tamil', 'English', 'Hindi', 'Telugu', 'Malayalam']
const SKILL_OPTIONS_STATIC = ['Customer Service', 'Delivery', 'Sales', 'Hospitality', 'Data Entry', 'Security', 'Driver']
const TRAVEL_DISTANCE_OPTIONS_STATIC = ['5 km', '10 km', '15 km', '20 km', '30 km']
const JOB_TYPE_OPTIONS_STATIC = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Work from Home']
const EDUCATION_LEVEL_OPTIONS_STATIC = ['10th Pass', '12th Pass', 'Diploma', 'Graduate', 'Postgraduate']
const SHIFT_OPTIONS_STATIC = ['Morning', 'Evening', 'Night', 'Rotational', 'Flexible']
const GENDER_OPTIONS_STATIC = ['Male', 'Female', 'Third Gender']
const COLLEGE_OPTIONS_STATIC = []
const DEGREE_OPTIONS_STATIC = ['B.A', 'B.Sc', 'B.Com', 'B.E', 'B.Tech', 'M.A', 'M.Sc']

const EMPTY_FORM = {
  // Personal Info
  firstName:'', lastName:'', fatherName:'', fullName:'', dob:'', gender:'', mobile:'', email:'', whatsapp:'',
  // Address
  presentAddress:'', permanentAddress:'', pincode:'', area:'', location:'',
  // Languages & Preferences
  languages:[], 
  // Education
  highestEducation:'', college:'', degree:'', yearOfCompletion:'', skills:[], resumeFile:null, resumeName:'',
  // Employment
  currentStatus:'', maxTravelDistance:'', travelDistance:'', jobTypePreference:[], jobTypes:[], shiftPreference:[],
  preferredWorkField:'', preferredField:'', currentCompany:'', yearsOfExperience:'', currentCTC:'', previousWorkDetails:'',
  // Financial/Employment Notes
  employmentNotes:'',
  // KYC/Documents
  aadhaarNumber:'', confirmAadhaarNumber:'', aadhaarNumberConfirm:'', panNumber:'',
  bankAccountNumber:'', bankAccount:'', ifscCode:'', accountHolderName:'', bankName:'',
  // Files
  facePhoto:null, facePhotoName:'', facePhotoUrl:'', profilePhoto:'',
  aadhaarFrontFile:null, aadhaarFront:null, aadhaarFrontName:'', aadhaarFrontUrl:'',
  aadhaarBackFile:null, aadhaarBack:null, aadhaarBackName:'', aadhaarBackUrl:'',
  // System
  state:'', candidateId:'', registrationId:''
}

const getFileName = (name) => {
  if (!name) return ''
  const stringName = String(name)
  return stringName.split(/[\\/]/).pop() || stringName
}

function mapGetToForm(data) {
  const p = data.personal   || {}
  const e = data.education  || {}
  const w = data.employment || {}
  const d = data.documents  || {}
  const b = data.bank       || {}
  
  const getValue = (val) => {
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val !== null) return val.name ?? val.value ?? val.label ?? val.text ?? ''
    return val ?? ''
  }
  
  const normalizeArrayField = (value) => {
    if (Array.isArray(value)) return value.map(getValue).filter(Boolean)
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return []
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed.map(getValue).filter(Boolean)
      } catch {
        // fall back to comma-separated values
      }
      return trimmed.split(',').map(item => item.trim()).filter(Boolean)
    }
    return []
  }

  const splitFullName = (value) => {
    const name = getValue(value)
    if (!name) return { firstName: '', lastName: '' }
    const parts = name.trim().split(/\s+/)
    return {
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || ''
    }
  }
  
  const fullName = p.firstName && p.lastName ? `${p.firstName} ${p.lastName}`.trim() : (getValue(p.fullName) || '')
  const { firstName: derivedFirstName, lastName: derivedLastName } = splitFullName(p.fullName)
  
  return {
    // Personal
    firstName: getValue(p.firstName) || derivedFirstName || '',
    lastName: getValue(p.lastName) || derivedLastName || '',
    fatherName: getValue(p.fatherName) || '',
    fullName: fullName,
    dob: getValue(p.dob) || '',
    gender: getValue(p.gender) || '',
    mobile: getValue(p.mobile) || '',
    email: getValue(p.email) || '',
    whatsapp: getValue(p.whatsapp) || '',
    state: getValue(p.state) || '',
    
    // Address
    presentAddress: getValue(p.presentAddress) || '',
    permanentAddress: getValue(p.permanentAddress) || '',
    pincode: getValue(p.pincode) || '',
    area: getValue(p.area) || getValue(p.location) || '',
    location: getValue(p.location) || getValue(p.area) || '',
    
    // Languages
    languages: normalizeArrayField(p.languages),
    
    // Education
    highestEducation: getValue(e.highestEducation) || getValue(e.education) || '',
    college: getValue(e.college) || '',
    degree: getValue(e.degree) || '',
    yearOfCompletion: getValue(e.yearOfCompletion) || getValue(e.completionYear) || '',
    skills: normalizeArrayField(e.skills),
    resumeFile: null,
    resumeName: getFileName(getValue(e.resumeName) || ''),
    
    // Employment
    currentStatus: getValue(w.currentStatus) || '',
    maxTravelDistance: getValue(w.maxTravelDistance) || getValue(w.travelDistance) || '',
    travelDistance: getValue(w.travelDistance) || getValue(w.maxTravelDistance) || '',
    jobTypePreference: normalizeArrayField(w.jobTypePreference).length ? normalizeArrayField(w.jobTypePreference) : normalizeArrayField(w.jobTypes),
    jobTypes: normalizeArrayField(w.jobTypes).length ? normalizeArrayField(w.jobTypes) : normalizeArrayField(w.jobTypePreference),
    shiftPreference: normalizeArrayField(w.shiftPreference),
    preferredWorkField: getValue(w.preferredWorkField) || getValue(w.preferredField) || '',
    preferredField: getValue(w.preferredField) || getValue(w.preferredWorkField) || '',
    currentCompany: getValue(w.currentCompany) || '',
    yearsOfExperience: getValue(w.yearsOfExperience) || '',
    currentCTC: getValue(w.currentCTC) || '',
    previousWorkDetails: getValue(w.previousWorkDetails) || '',
    employmentNotes: getValue(w.employmentNotes) || '',
    
    // Documents/KYC
    aadhaarNumber: getValue(d.aadhaarNumber) || '',
    confirmAadhaarNumber: getValue(d.confirmAadhaarNumber) || getValue(d.aadhaarNumberConfirm) || '',
    aadhaarNumberConfirm: getValue(d.aadhaarNumberConfirm) || getValue(d.confirmAadhaarNumber) || '',
    panNumber: getValue(d.panNumber) || '',
    facePhotoName: getFileName(getValue(d.facePhotoName) || ''),
    facePhotoUrl: getValue(d.facePhotoUrl) || '',
    aadhaarFrontFile: null,
    aadhaarFrontName: getFileName(getValue(d.aadhaarFrontName) || ''),
    aadhaarFrontUrl: getValue(d.aadhaarFrontUrl) || '',
    aadhaarBackFile: null,
    aadhaarBackName: getFileName(getValue(d.aadhaarBackName) || ''),
    aadhaarBackUrl: getValue(d.aadhaarBackUrl) || '',
    
    // Bank
    bankAccountNumber: getValue(b.bankAccountNumber) || getValue(b.bankAccount) || '',
    bankAccount: getValue(b.bankAccount) || getValue(b.bankAccountNumber) || '',
    ifscCode: getValue(b.ifscCode) || '',
    accountHolderName: getValue(b.accountHolderName) || '',
    bankName: getValue(b.bankName) || '',
    
    // System
    facePhoto: null,
    profilePhoto: '',
    candidateId: data.candidateId || data.candidate_id || data.id || data._id || '',
    registrationId: data.registrationId || data.registration_id || ''
  }
}

const normalizeMasterDataOptions = (responseData) => {
  const raw = responseData?.data?.data ?? responseData?.data ?? responseData ?? []
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === 'string') return item
    if (item == null) return null
    return item.name ?? item.value ?? item.label ?? item.title ?? item.text ?? item.code ?? item.id ?? null
  }).filter(Boolean)
}

function validate(form) {
  const errs = {}
  if (!form.firstName.trim())         errs.firstName         = 'First name is required'
  if (!form.lastName.trim())          errs.lastName          = 'Last name is required'
  if (!form.presentAddress.trim())    errs.presentAddress    = 'Present address is required'
  if (!form.pincode.trim())           errs.pincode           = 'Pincode is required'
  if (!form.area.trim())              errs.area              = 'Area/Location is required'
  if (!form.location.trim())          errs.location          = 'Location is required'
  if (!form.languages.length)         errs.languages         = 'Select at least one language'
  if (!form.highestEducation)         errs.highestEducation  = 'Select education level'
  if (!form.currentStatus)            errs.currentStatus     = 'Select current status'
  if (!form.jobTypePreference.length) errs.jobTypePreference = 'Select at least one job type'
  if (!form.aadhaarFrontUrl && !form.aadhaarFrontFile) errs.aadhaarFront = 'Upload Aadhaar front image'
  if (!form.aadhaarBackUrl && !form.aadhaarBackFile) errs.aadhaarBack = 'Upload Aadhaar back image'
  if (form.aadhaarNumber && !form.aadhaarNumber.replace(/\s/g, '').match(/^\d{12}$/))
    errs.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number'
  if (form.confirmAadhaarNumber && form.aadhaarNumber !== form.confirmAadhaarNumber)
    errs.confirmAadhaarNumber = 'Aadhaar numbers do not match'
  if (form.panNumber && !form.panNumber.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/))
    errs.panNumber = 'Enter a valid PAN number (e.g., ABCDE1234F)'
  if (form.bankAccountNumber && form.bankAccountNumber.length < 8)
    errs.bankAccountNumber = 'Enter a valid bank account number'
  return errs
}

const formatAadhaar = (value) => {
  const digits = value.replace(/\s/g, '').slice(0, 12)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}
const maskAadhaar = (value) => {
  const digits = value.replace(/\s/g, '')
  if (digits.length !== 12) return value
  return `XXXX XXXX ${digits.slice(-4)}`
}
const maskBankAccount = (value) => {
  if (!value || value.length < 8) return value
  return 'XXXX' + value.slice(-4)
}
const downloadFile = (url, fileName) => {
  if (!url) { alert('No file available to download'); return }
  const downloadName = getFileName(fileName) || 'document'
  const link = document.createElement('a')
  link.href = url; link.download = downloadName
  document.body.appendChild(link); link.click(); document.body.removeChild(link)
}

const scrollToField = (fieldName) => {
  if (!fieldName || typeof document === 'undefined') return
  const el = document.querySelector(`[data-field="${fieldName}"]`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const focusable = el.querySelector('input, textarea, select, [role="combobox"]')
  if (focusable && typeof focusable.focus === 'function') focusable.focus()
}

// Returns the current selected option value including OTHER_OPTION fallback
function getSelectValue(options, formValue, isOtherActive) {
  if (!formValue && !isOtherActive) return null
  if (isOtherActive) return OTHER_OPTION
  const found = options.find(opt => opt.value === formValue)
  if (found) return found
  return { label: formValue, value: formValue }
}

const OTHER_OPTION = { label: 'Other (Please specify)', value: '__OTHER__' }

const handleDropdown = ({ field, setShow, setCustom, clearError }) => (selected) => {
  if (!selected) {
    setForm(f => ({ ...f, [field]: '' }))
    setShow(false)
    setCustom('')
    if (clearError) clearError()
    return
  }
  
  if (selected.value === '__OTHER__') {
    setShow(true)
    setForm(f => ({ ...f, [field]: '' }))
  } else {
    setShow(false)
    setCustom('')
    setForm(f => ({ ...f, [field]: selected.value }))
  }
  if (clearError) clearError()
}

const OtherInput = ({ show, value, placeholder, onChange }) => {
  if (!show) return null
  return (
    <input
      type="text"
      style={{ ...iStyle(true, false), marginTop: 8 }}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  )
}

export default function CandidateProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form,            setForm]          = useState({ ...EMPTY_FORM })
  const [savedForm,       setSavedForm]     = useState({ ...EMPTY_FORM })
  const [editMode,        setEditMode]      = useState(false)
  const [errors,          setErrors]        = useState({})
  const [loadStatus,      setLoadStatus]    = useState('loading')
  const [saveStatus,      setSaveStatus]    = useState(null)
  const [showAadhaar,     setShowAadhaar]   = useState(false)
  const [showBankAccount, setShowBankAccount] = useState(false)
  const [aadhaarVerified, setAadhaarVerified] = useState(null)

  const [areaOptions,           setAreaOptions]           = useState([])
  const [languageOptions,       setLanguageOptions]       = useState([])
  const [skillsOptions,         setSkillsOptions]         = useState([])
  const [travelDistanceOptions, setTravelDistanceOptions] = useState([])
  const [jobTypeOptions,        setJobTypeOptions]        = useState([])
  const [educationLevelOptions, setEducationLevelOptions] = useState([])
  const [shiftOptions,          setShiftOptions]          = useState([])
  const [genderOptions,         setGenderOptions]         = useState([])
  const [collegeOptions,        setCollegeOptions]        = useState([])
  const [degreeOptions,         setDegreeOptions]         = useState([])
  const [currentStatusOptions,  setCurrentStatusOptions]  = useState([])
  
  // Custom "Other" field state
  const [showCustomEducation, setShowCustomEducation] = useState(false)
  const [customEducation, setCustomEducation] = useState('')
  const [showCustomCollege, setShowCustomCollege] = useState(false)
  const [customCollege, setCustomCollege] = useState('')
  const [showCustomDegree, setShowCustomDegree] = useState(false)
  const [customDegree, setCustomDegree] = useState('')

  const CustomDropdownIndicator = (props) => {
    const { selectProps } = props;
    const isMobile = window.innerWidth <= 768;
    return (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {selectProps.inputValue && isMobile && (
          <div 
            style={{ padding: '0 5px', cursor: 'pointer', color: 'var(--teal)' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const val = selectProps.inputValue;
              if (selectProps.isMulti) {
                const currentValues = selectProps.value || [];
                selectProps.onChange([...currentValues, { label: val, value: val }], { action: 'create-option' });
              } else {
                selectProps.onChange({ label: val, value: val }, { action: 'create-option' });
              }
            }}
          >
            <i className="fas fa-check-circle" style={{ fontSize: '18px' }}></i>
          </div>
        )}
        <components.DropdownIndicator {...props} />
      </div>
    );
  };

  const registrationId = user?.registrationId || user?.registration_id || ''

  useEffect(() => {
    setAreaOptions(AREA_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setLanguageOptions(LANGUAGE_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setSkillsOptions(SKILL_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setTravelDistanceOptions(TRAVEL_DISTANCE_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setJobTypeOptions(JOB_TYPE_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setEducationLevelOptions(EDUCATION_LEVEL_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setShiftOptions(SHIFT_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setGenderOptions(GENDER_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setCollegeOptions(COLLEGE_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setDegreeOptions(DEGREE_OPTIONS_STATIC.map(item => ({ value: item, label: item })))
    setCurrentStatusOptions(CURRENT_STATUSES.map(item => ({ value: item, label: item })))
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await candidateAPI.getProfile(registrationId)
        const mapped = mapGetToForm(profileRes.data || {})
        setForm(mapped)
        setSavedForm(mapped)
      } catch (error) {
        console.error('Profile fetch error:', error)
      } finally {
        setLoadStatus('ready')
      }
    }

    if (registrationId) {
      fetchProfile()
    }
  }, [registrationId])

  useEffect(() => {
    const loadVerification = async () => {
      if (!registrationId || !savedForm.aadhaarNumber || editMode) return
      try {
        const params = {
          registration_id: registrationId,
          aadhaar: savedForm.aadhaarNumber.replace(/\s/g, ''),
        }
        const candidateIdValue = savedForm.candidateId || registrationId
        if (candidateIdValue) params.candidate_id = candidateIdValue

        const response = await candidateAPI.checkAadhaarVerification(params)
        const verified = response?.data?.verified ?? response?.data?.isVerified ?? response?.data?.data?.verified ?? response?.data?.data?.isVerified ?? false
        setAadhaarVerified(Boolean(verified))
      } catch (error) {
        console.warn('Aadhaar verification status check failed:', error)
        setAadhaarVerified(false)
      }
    }
    loadVerification()
  }, [registrationId, savedForm.aadhaarNumber, savedForm.candidateId, editMode])

  const setEditable = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }))
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  const handleEdit   = () => { setEditMode(true); setErrors({}) }
  const handleCancel = () => { setForm({ ...savedForm }); setEditMode(false); setErrors({}) }

const handleSave = async () => {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); scrollToField(Object.keys(errs)[0]); return }
    setErrors({})
    setSaveStatus('saving')
    
    const formData = new FormData()
    
    // Build payload structure aligned with registration data
    const payload = {
      personal: {
        firstName: form.firstName,
        lastName: form.lastName,
        fatherName: form.fatherName,
        fullName: form.fullName || `${form.firstName} ${form.lastName}`.trim(),
        dob: form.dob,
        gender: form.gender,
        mobile: form.mobile,
        email: form.email,
        whatsapp: form.whatsapp,
        state: form.state,
        presentAddress: form.presentAddress,
        permanentAddress: form.permanentAddress,
        pincode: form.pincode,
        area: form.area,
        location: form.location,
        languages: form.languages
      },
      education: {
        highestEducation: form.highestEducation,
        college: form.college,
        degree: form.degree,
        yearOfCompletion: form.yearOfCompletion,
        completionYear: form.yearOfCompletion,
        skills: form.skills,
        resumeName: form.resumeFile ? form.resumeFile.name : (form.resumeName || '')
      },
      employment: {
        currentStatus: form.currentStatus,
        maxTravelDistance: form.maxTravelDistance,
        travelDistance: form.maxTravelDistance,
        jobTypePreference: form.jobTypePreference,
        jobTypes: form.jobTypePreference,
        shiftPreference: form.shiftPreference,
        preferredWorkField: form.preferredWorkField,
        preferredField: form.preferredWorkField,
        currentCompany: form.currentCompany,
        yearsOfExperience: form.yearsOfExperience,
        currentCTC: form.currentCTC,
        previousWorkDetails: form.previousWorkDetails,
        employmentNotes: form.employmentNotes
      },
      documents: {
        aadhaarNumber: form.aadhaarNumber,
        confirmAadhaarNumber: form.confirmAadhaarNumber || form.aadhaarNumberConfirm,
        aadhaarNumberConfirm: form.confirmAadhaarNumber || form.aadhaarNumberConfirm,
        panNumber: form.panNumber,
        facePhotoName: form.facePhotoName,
        aadhaarFrontName: form.aadhaarFrontName,
        aadhaarBackName: form.aadhaarBackName,
      },
      bank: {
        bankAccountNumber: form.bankAccountNumber || form.bankAccount,
        bankAccount: form.bankAccountNumber || form.bankAccount,
        ifscCode: form.ifscCode,
        accountHolderName: form.accountHolderName,
        bankName: form.bankName
      }
    }
    
    formData.append('data', JSON.stringify(payload))

    const candidateIdentifier = form.candidateId || registrationId || form.registrationId
    const uploadPromises = []
    const updatePromise = candidateAPI.updateProfile(registrationId || form.registrationId, formData)

    if (candidateIdentifier && form.resumeFile instanceof File) {
      uploadPromises.push(candidateAPI.uploadResume(candidateIdentifier, form.resumeFile))
    }
    if (candidateIdentifier && form.aadhaarFrontFile instanceof File) {
      uploadPromises.push(candidateAPI.uploadAadhaarFront(candidateIdentifier, form.aadhaarFrontFile))
    }
    if (candidateIdentifier && form.aadhaarBackFile instanceof File) {
      uploadPromises.push(candidateAPI.uploadAadhaarBack(candidateIdentifier, form.aadhaarBackFile))
    }

    try {
      if (uploadPromises.length) {
        await Promise.all([updatePromise, ...uploadPromises])
      } else {
        await updatePromise
      }

      setSaveStatus('saved')
      setSavedForm({ ...form })
      setEditMode(false)
    } catch (error) {
      console.error('Update error:', error)
      setSaveStatus('error')
    }
    setTimeout(() => setSaveStatus(null), 3000)
}

  const initials = form.firstName && form.lastName ? `${form.firstName[0]}${form.lastName[0]}`.toUpperCase() : (form.fullName ? form.fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?')

  if (loadStatus === 'loading') {
    return (
      <div style={{ ...styles.page, display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ textAlign:'center', color:'#0E7C86' }}>
          <FontAwesomeIcon icon={faSpinner} spin style={{ fontSize:32, marginBottom:12 }} />
          <div style={{ fontWeight:600 }}>Loading your profile…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <LoadingOverlay active={saveStatus === 'saving'} message="Saving profile changes..." />
      <LoadingOverlay active={loadStatus === 'loading'} message="Loading your profile..." />

      <div style={styles.topBar}>
        <div>
          <h1 style={styles.pageTitle}>My Profile</h1>
          <p style={styles.pageSubtitle}>Keep your profile updated for better gig matches</p>
        </div>
        <div style={styles.topActions}>
          {!editMode ? (
            <button style={styles.btnEdit} onClick={handleEdit}><FontAwesomeIcon icon={faPencilAlt} /> Edit Profile</button>
          ) : (
            <>
              <button style={styles.btnCancel} onClick={handleCancel}><FontAwesomeIcon icon={faTimes} /> Cancel</button>
              <button style={{ ...styles.btnSave, opacity: saveStatus === 'saving' ? 0.7 : 1 }} onClick={handleSave} disabled={saveStatus === 'saving'}>
                {saveStatus === 'saving' ? <><FontAwesomeIcon icon={faSpinner} spin /> Saving…</> : <><FontAwesomeIcon icon={faSave} /> Save Changes</>}
              </button>
            </>
          )}
        </div>
      </div>

      {aadhaarVerified === false && !editMode && (
        <VerificationBanner
          message="Aadhaar is not verified for this profile. Please verify your Aadhaar to complete KYC."
          buttonText="Verify Aadhaar"
          onAction={() => {
            const aadhaar = savedForm.aadhaarNumber.replace(/\s/g, '')
            const candidateIdValue = savedForm.candidateId || registrationId
            const params = new URLSearchParams()
            if (aadhaar) params.set('aadhaar', aadhaar)
            if (candidateIdValue) params.set('candidate_id', candidateIdValue)
            navigate(`/attendance/kycverify?${params.toString()}`)
          }}
        />
      )}

      <div style={styles.hero}>
        <div style={styles.heroLeft}>
          <div style={styles.avatar}>{initials}</div>
          <div>
            <div style={styles.heroName}>{form.firstName && form.lastName ? `${form.firstName} ${form.lastName}` : form.fullName || 'Your Name'}</div>
            <div style={styles.heroRole}>{form.jobTypePreference.length ? form.jobTypePreference.join(' · ') : 'Add job preference below'}</div>
            <div style={styles.heroMeta}>
              {form.area && <span style={styles.heroMetaItem}><FontAwesomeIcon icon={faMapMarkerAlt} style={{ color:'#1AA8B5' }} /> {form.area}</span>}
              {form.mobile && <span style={styles.heroMetaItem}><FontAwesomeIcon icon={faPhone} style={{ color:'#1AA8B5' }} /> +91 {form.mobile}</span>}
              {form.email && <span style={styles.heroMetaItem}><FontAwesomeIcon icon={faEnvelope} style={{ color:'#1AA8B5' }} /> {form.email}</span>}
            </div>
          </div>
        </div>
        
      </div>

      {/* KYC Documents - View Only */}
      <Section icon={faIdCard} title="KYC & Documents">
        <div style={{ marginBottom: 24 }}>
          <div style={{ ...styles.warningBox, marginBottom: 16 }}>
            <FontAwesomeIcon icon={faIdCard} style={{ color: '#0E7C86', marginRight: 8 }} />
            <span style={{ fontSize: 13, color: '#184E55' }}>Aadhaar and PAN are editable here. Face photo and Aadhaar images are shown as previews when available.</span>
          </div>
          <Grid2>
            <Field label="Face Photo">
              <div style={{ ...styles.documentDisplayWithActions, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.documentInfo}><FontAwesomeIcon icon={faFileAlt} style={{ color: '#0E7C86' }} /><span>{form.facePhotoUrl ? 'Face photo uploaded' : 'No photo uploaded'}</span></div>
                  {form.facePhotoUrl && <img src={form.facePhotoUrl} alt="Face preview" style={styles.documentPreview} />}
                </div>
                {form.facePhotoUrl && <button style={styles.downloadBtn} onClick={() => downloadFile(form.facePhotoUrl, form.facePhotoName)}><FontAwesomeIcon icon={faDownload} /> Download</button>}
              </div>
            </Field>
            <Field label="Aadhaar Card (Front)" error={errors.aadhaarFront} fieldName="aadhaarFront">
              <div style={{ ...styles.documentDisplayWithActions, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.documentInfo}><FontAwesomeIcon icon={faFileAlt} style={{ color: '#0E7C86' }} /><span>{form.aadhaarFrontUrl ? 'Aadhaar front uploaded' : 'No file uploaded'}</span></div>
                  {form.aadhaarFrontUrl && <img src={form.aadhaarFrontUrl} alt="Aadhaar front" style={styles.documentPreview} />}
                  {editMode && !form.aadhaarFrontUrl && <div style={styles.emptyHint}>Upload Aadhaar front image</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.aadhaarFrontUrl && <button style={styles.downloadBtn} onClick={() => downloadFile(form.aadhaarFrontUrl, form.aadhaarFrontName)}><FontAwesomeIcon icon={faDownload} /> Download</button>}
                  {editMode && (
                    <FileUpload
                      onFilesChange={(files) => {
                        const file = files[0] || null
                        setForm(prev => ({
                          ...prev,
                          aadhaarFrontFile: file,
                          aadhaarFrontName: file ? file.name : prev.aadhaarFrontName,
                          aadhaarFrontUrl: file ? URL.createObjectURL(file) : prev.aadhaarFrontUrl
                        }))
                        if (errors.aadhaarFront) setErrors(prev => { const n = { ...prev }; delete n.aadhaarFront; return n })
                      }}
                      disabled={!editMode}
                      accept={['.jpg', '.jpeg', '.png']}
                      maxFiles={1}
                      label={form.aadhaarFrontUrl ? 'Replace Aadhaar front' : 'Upload Aadhaar front'}
                    />
                  )}
                </div>
              </div>
            </Field>
            <Field label="Aadhaar Card (Back)" error={errors.aadhaarBack} fieldName="aadhaarBack">
              <div style={{ ...styles.documentDisplayWithActions, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.documentInfo}><FontAwesomeIcon icon={faFileAlt} style={{ color: '#0E7C86' }} /><span>{form.aadhaarBackUrl ? 'Aadhaar back uploaded' : 'No file uploaded'}</span></div>
                  {form.aadhaarBackUrl && <img src={form.aadhaarBackUrl} alt="Aadhaar back" style={styles.documentPreview} />}
                  {editMode && !form.aadhaarBackUrl && <div style={styles.emptyHint}>Upload Aadhaar back image</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.aadhaarBackUrl && <button style={styles.downloadBtn} onClick={() => downloadFile(form.aadhaarBackUrl, form.aadhaarBackName)}><FontAwesomeIcon icon={faDownload} /> Download</button>}
                  {editMode && (
                    <FileUpload
                      onFilesChange={(files) => {
                        const file = files[0] || null
                        setForm(prev => ({
                          ...prev,
                          aadhaarBackFile: file,
                          aadhaarBackName: file ? file.name : prev.aadhaarBackName,
                          aadhaarBackUrl: file ? URL.createObjectURL(file) : prev.aadhaarBackUrl
                        }))
                        if (errors.aadhaarBack) setErrors(prev => { const n = { ...prev }; delete n.aadhaarBack; return n })
                      }}
                      disabled={!editMode}
                      accept={['.jpg', '.jpeg', '.png']}
                      maxFiles={1}
                      label={form.aadhaarBackUrl ? 'Replace Aadhaar back' : 'Upload Aadhaar back'}
                    />
                  )}
                </div>
              </div>
            </Field>
          </Grid2>
          <div style={styles.separator} />
          <Grid2>
            <Field label="AADHAAR NUMBER">
              <div style={styles.maskedValue}>
                {maskAadhaar(savedForm.aadhaarNumber) || 'Not provided'}
                {savedForm.aadhaarNumber && <button style={styles.showHideBtn} onClick={() => setShowAadhaar(!showAadhaar)}><FontAwesomeIcon icon={faEye} /> {showAadhaar ? 'Hide' : 'Show'}</button>}
              </div>
              <div style={styles.fieldHint}>Contact support to edit your Aadhaar number</div>
              {errors.aadhaarNumber && <div style={styles.fieldError}>{errors.aadhaarNumber}</div>}
              {showAadhaar && savedForm.aadhaarNumber && <div style={styles.fullAadhaar}>{formatAadhaar(savedForm.aadhaarNumber)}</div>}
            </Field>
            <Field label="CONFIRM AADHAAR NUMBER">
              {editMode ? (
                <Inp editable={false} value={form.confirmAadhaarNumber} placeholder="Aadhaar number cannot be changed here" />
              ) : (
                <div style={styles.emptyHint}>Not shown when viewing only</div>
              )}
              {editMode && errors.confirmAadhaarNumber && <div style={styles.fieldError}>{errors.confirmAadhaarNumber}</div>}
            </Field>
            <Field label="PAN NUMBER (OPTIONAL)">
              {editMode ? (
                <Inp editable={true} value={form.panNumber} onChange={setEditable('panNumber')} placeholder="Enter PAN number" />
              ) : (
                <div style={styles.maskedValue}>{savedForm.panNumber ? savedForm.panNumber.replace(/.(?=.{4})/g, 'X') : 'Not provided'}</div>
              )}
              {editMode && errors.panNumber && <div style={styles.fieldError}>{errors.panNumber}</div>}
            </Field>
          </Grid2>
        </div>
      </Section>

      {/* Personal Details */}
      <Section icon={faUser} title="Personal Details">
        <Grid2>
          <Field label="First Name *" error={errors.firstName} fieldName="firstName">
            <Inp editable={editMode} hasError={!!errors.firstName} value={form.firstName} onChange={setEditable('firstName')} placeholder="e.g. Arjun" />
          </Field>
          <Field label="Last Name *" error={errors.lastName} fieldName="lastName">
            <Inp editable={editMode} hasError={!!errors.lastName} value={form.lastName} onChange={setEditable('lastName')} placeholder="e.g. Kumar" />
          </Field>
          <Field label="Father's Name">
            <Inp editable={editMode} value={form.fatherName} onChange={setEditable('fatherName')} placeholder="e.g. Ramesh Kumar" />
          </Field>
          <Field label="Date of Birth">
            <Inp editable={editMode} type="date" value={form.dob} onChange={setEditable('dob')} />
          </Field>

          {/* Gender - NO "Other" option */}
          <Field label="Gender">
            {editMode ? (
              <CreatableSelect
                options={genderOptions}
                value={form.gender ? (genderOptions.find(opt => opt.value === form.gender) || { label: form.gender, value: form.gender }) : null}
                onChange={(selected) => {
                  setForm(f => ({ ...f, gender: selected ? selected.value : '' }))
                }}
                placeholder="Select gender"
                styles={selectStyles}
                isClearable
                components={{ DropdownIndicator: CustomDropdownIndicator }}
              />
            ) : <Inp editable={false} value={form.gender} />}
          </Field>

          <Field label="Mobile">
            <Inp editable={false} value={form.mobile} />
            <div style={styles.fieldHint}>Contact support to change mobile number</div>
          </Field>
          <Field label="Email">
            <Inp editable={false} value={form.email} />
            <div style={styles.fieldHint}>Contact support to change email</div>
          </Field>
          
          <Field label="WhatsApp Number">
            <Inp editable={editMode} type="tel" value={form.whatsapp} onChange={setEditable('whatsapp')} placeholder="10-digit WhatsApp number" />
          </Field>
        </Grid2>
      </Section>

      {/* Address */}
      <Section icon={faMapMarkerAlt} title="Address">
        <Grid2>
          <Field label="Present Address *" error={errors.presentAddress} fieldName="presentAddress">
            <Inp editable={editMode} hasError={!!errors.presentAddress} value={form.presentAddress} onChange={setEditable('presentAddress')} placeholder="e.g. House No. 123, Street Name" />
          </Field>
          <Field label="Permanent Address">
            <Inp editable={editMode} value={form.permanentAddress} onChange={setEditable('permanentAddress')} placeholder="e.g. House No. 456, Street Name" />
          </Field>
          <Field label="Pincode *" error={errors.pincode} fieldName="pincode">
            <Inp editable={editMode} hasError={!!errors.pincode} value={form.pincode} onChange={setEditable('pincode')} placeholder="e.g. 600001" />
          </Field>
          <Field label="Area/Location *" error={errors.area} fieldName="area">
            {editMode ? (
              <CreatableSelect
                options={areaOptions}
                value={form.area ? (areaOptions.find(opt => opt.value === form.area) || { label: form.area, value: form.area }) : null}
                onChange={(selected) => {
                  setForm(f => ({ ...f, area: selected ? selected.value : '', location: selected ? selected.value : '' }));
                  if (errors.area) setErrors(prev => { const n = { ...prev }; delete n.area; return n })
                }}
                placeholder="Select your area" styles={selectStyles}
                components={{ DropdownIndicator: CustomDropdownIndicator }}
              />
            ) : <Inp editable={false} value={form.area} />}
          </Field>
          <Field label="Languages Known *" error={errors.languages} fieldName="languages">
            {editMode ? (
              <CreatableSelect
                isMulti
                options={languageOptions}
                value={form.languages?.map(lang => ({ label: lang, value: lang })) || []}
                onChange={(selected) => {
                  setForm(f => ({ ...f, languages: selected ? selected.map(s => s.value) : [] }))
                  if (errors.languages) setErrors(prev => { const n = { ...prev }; delete n.languages; return n })
                }} placeholder="Select languages" styles={selectStyles} components={{ DropdownIndicator: CustomDropdownIndicator }} />
            ) : <Inp editable={false} value={form.languages.join(', ')} />}
          </Field>
        </Grid2>
      </Section>

      {/* Education & Skills */}
      <Section icon={faGraduationCap} title="Education & Skills">
        <Grid2>
          {/* Highest Education - WITH "Other" option */}
          <Field label="Highest Education *" error={errors.highestEducation} fieldName="highestEducation">
            {editMode ? (
              <>
                <CreatableSelect
                  isClearable
                  isSearchable
                  options={educationLevelOptions}
                  value={getSelectValue(educationLevelOptions, form.highestEducation, showCustomEducation)}
                  onChange={handleDropdown({ field: 'highestEducation', setShow: setShowCustomEducation, setCustom: setCustomEducation, clearError: () => setErrors(prev => { const n = { ...prev }; delete n.highestEducation; return n }) })}
                  placeholder="Select education level" styles={selectStyles}
                  formatCreateLabel={(inputValue) => `Use "${inputValue}"`}
                />
                <OtherInput show={showCustomEducation} value={customEducation} placeholder="Please specify your education"
                  onChange={(e) => { setCustomEducation(e.target.value); setForm(f => ({ ...f, highestEducation: e.target.value })) }} />
              </>
            ) : <Inp editable={false} value={form.highestEducation} />}
          </Field>

          {/* College - WITH "Other" option */}
          <Field label="College / Institution">
            {editMode ? (
              <>
                <CreatableSelect
                  isClearable
                  isSearchable
                  options={collegeOptions}
                  value={getSelectValue(collegeOptions, form.college, showCustomCollege)}
                  onChange={handleDropdown({ field: 'college', setShow: setShowCustomCollege, setCustom: setCustomCollege })}
                  placeholder="Select college" styles={selectStyles}
                  formatCreateLabel={(inputValue) => `Use "${inputValue}"`}
                />
                <OtherInput show={showCustomCollege} value={customCollege} placeholder="Please specify your college / institution"
                  onChange={(e) => { setCustomCollege(e.target.value); setForm(f => ({ ...f, college: e.target.value })) }} />
              </>
            ) : <Inp editable={false} value={form.college} placeholder="Enter college name" />}
          </Field>

          {/* Degree - WITH "Other" option */}
          <Field label="Degree / Course">
            {editMode ? (
              <>
                <CreatableSelect
                  isClearable
                  isSearchable
                  options={degreeOptions}
                  value={getSelectValue(degreeOptions, form.degree, showCustomDegree)}
                  onChange={handleDropdown({ field: 'degree', setShow: setShowCustomDegree, setCustom: setCustomDegree })}
                  placeholder="Select degree" styles={selectStyles}
                  formatCreateLabel={(inputValue) => `Use "${inputValue}"`}
                />
                <OtherInput show={showCustomDegree} value={customDegree} placeholder="Please specify your degree / course"
                  onChange={(e) => { setCustomDegree(e.target.value); setForm(f => ({ ...f, degree: e.target.value })) }} />
              </>
            ) : <Inp editable={false} value={form.degree} />}
          </Field>

          <Field label="Year of Completion">
            <Inp editable={editMode} type="date" value={form.yearOfCompletion} onChange={setEditable('yearOfCompletion')} />
          </Field>
        </Grid2>

        <div style={{ marginTop:16 }}>
          <label style={styles.label}>Your Skills * (select all that apply)</label>
          {errors.skills && <div style={styles.fieldError}>{errors.skills}</div>}
          <CreatableSelect
            isMulti
            options={skillsOptions}
            value={form.skills?.map(s => ({ label: s, value: s })) || []}
            onChange={(selected) => { setForm(f => ({ ...f, skills: selected ? selected.map(s => s.value) : [] })); if (errors.skills) setErrors(prev => { const n = { ...prev }; delete n.skills; return n }) }}
            disabled={!editMode} placeholder="Select skills" styles={selectStyles} components={{ DropdownIndicator: CustomDropdownIndicator }} />
        </div>

        <div style={{ marginTop: 20 }}>
  <label style={styles.label}>Resume / CV (Optional)</label>
  {editMode ? (
    <div>
      {form.resumeName && (
        <div style={{ 
          background: '#f0fdf4', 
          border: '1px solid #bbf7d0', 
          borderRadius: 8, 
          padding: '10px 14px', 
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13
        }}>
          <FontAwesomeIcon icon={faFileAlt} style={{ color: '#10b981' }} />
          <span style={{ flex: 1 }}>Current resume: <strong>{getFileName(form.resumeName)}</strong></span>
          <span style={{ fontSize: 12, color: '#64748b' }}>(Upload new file to replace)</span>
        </div>
      )}
      <FileUpload 
        onFilesChange={(files) => { 
          const file = files[0] || null; 
          setForm(prev => ({ 
            ...prev, 
            resumeFile: file, 
            resumeName: file ? file.name : prev.resumeName
          }))
        }}
        disabled={!editMode} 
        accept={['.pdf', '.doc', '.docx']} 
        maxFiles={1} 
        label="Upload your Resume"
      />
    </div>
  ) : (
    <div style={styles.resumeDisplay}>
      {savedForm.resumeName ? <><FontAwesomeIcon icon={faFileAlt} style={{ color:'#0E7C86' }} /> {getFileName(savedForm.resumeName)}</> : <span style={styles.emptyHint}>No resume uploaded</span>}
    </div>
  )}
</div>
      </Section>

      {/* Employment Details - NO "Other" options */}
      <Section icon={faBriefcase} title="Employment Details">
        <Grid2>
          {/* Current Status - NO "Other" option */}
          <Field label="Current Status *" error={errors.currentStatus} fieldName="currentStatus">
            {editMode ? (
              <CreatableSelect
                options={currentStatusOptions}
                value={form.currentStatus ? (currentStatusOptions.find(opt => opt.value === form.currentStatus) || { label: form.currentStatus, value: form.currentStatus }) : null}
                onChange={(selected) => {
                  setForm(f => ({ ...f, currentStatus: selected ? selected.value : '' }))
                  if (errors.currentStatus) setErrors(prev => { const n = { ...prev }; delete n.currentStatus; return n })
                }}
                placeholder="Select current status"
                styles={selectStyles}
                isClearable
                components={{ DropdownIndicator: CustomDropdownIndicator }}
              />
            ) : <Inp editable={false} value={form.currentStatus} />}
          </Field>

          {/* Max Travel Distance - NO "Other" option */}
          <Field label="Max Travel Distance">
            {editMode ? (
              <CreatableSelect
                options={travelDistanceOptions}
                value={form.maxTravelDistance ? (travelDistanceOptions.find(opt => opt.value === form.maxTravelDistance) || { label: form.maxTravelDistance, value: form.maxTravelDistance }) : null}
                onChange={(selected) => {
                  setForm(f => ({ ...f, maxTravelDistance: selected ? selected.value : '' }))
                }}
                placeholder="Select travel distance"
                styles={selectStyles}
                isClearable
                components={{ DropdownIndicator: CustomDropdownIndicator }}
              />
            ) : <Inp editable={false} value={form.maxTravelDistance} />}
          </Field>

          <Field label="Current Company">
            <Inp editable={editMode} value={form.currentCompany} onChange={setEditable('currentCompany')} placeholder="e.g. ABC Industries Ltd." />
          </Field>
          <Field label="Years of Experience">
            <Inp editable={editMode} type="number" value={form.yearsOfExperience} onChange={setEditable('yearsOfExperience')} placeholder="e.g. 3.5" min="0" step="0.5" />
          </Field>
          <Field label="Current CTC">
            <Inp editable={editMode} value={form.currentCTC} onChange={setEditable('currentCTC')} placeholder="e.g. 3,50,000" />
          </Field>
        </Grid2>

        <Field label="Preferred Work Field / Industry" style={{ marginTop:16 }}>
          <Inp editable={editMode} value={form.preferredWorkField} onChange={setEditable('preferredWorkField')} placeholder="e.g. Hospitality, Logistics, Retail" />
        </Field>

        <Field label="Job Type Preference *" error={errors.jobTypePreference} fieldName="jobTypePreference" style={{ marginTop:16 }}>
          <CreatableSelect
            isMulti
            options={jobTypeOptions}
            value={form.jobTypePreference?.map(jt => ({ label: jt, value: jt })) || []}
            onChange={(selected) => { setForm(f => ({ ...f, jobTypePreference: selected ? selected.map(s => s.value) : [] })); if (errors.jobTypePreference) setErrors(prev => { const n = { ...prev }; delete n.jobTypePreference; return n }) }}
            disabled={!editMode} placeholder="Select job types" styles={selectStyles} components={{ DropdownIndicator: CustomDropdownIndicator }} />
        </Field>

        <div style={{ marginTop:16 }}>
          <label style={styles.label}>Shift Preference</label>
          <CreatableSelect
            isMulti
            options={shiftOptions}
            value={form.shiftPreference?.map(s => ({ label: s, value: s })) || []}
            onChange={(selected) => { setForm(f => ({ ...f, shiftPreference: selected ? selected.map(s => s.value) : [] })) }}
            disabled={!editMode} placeholder="Select shifts" styles={selectStyles} components={{ DropdownIndicator: CustomDropdownIndicator }} />
        </div>

        <div style={{ marginTop:16 }}>
          <label style={styles.label}>Previous Work Details</label>
          <textarea style={{ ...iStyle(editMode), height:100, resize:'vertical', fontFamily:'inherit' }}
            value={form.previousWorkDetails} onChange={setEditable('previousWorkDetails')}
            disabled={!editMode} placeholder="Enter your previous work details or related experience" />
        </div>

        <div style={{ marginTop:16 }}>
          <label style={styles.label}>Employment Notes</label>
          <textarea style={{ ...iStyle(editMode), height:80, resize:'vertical', fontFamily:'inherit' }}
            value={form.employmentNotes} onChange={setEditable('employmentNotes')}
            disabled={!editMode} placeholder="Any additional employment information" />
        </div>
      </Section>

      {/* Bank Details - Editable */}
      <Section icon={faUniversity} title="Bank Details">
        <Grid2>
          <Field label="Bank Account Number">
            <div style={styles.maskedValue}>
              {editMode ? (
                <Inp editable={true} value={form.bankAccountNumber} onChange={setEditable('bankAccountNumber')} placeholder="Enter account number" />
              ) : (
                <>
                  {form.bankAccountNumber ? maskBankAccount(form.bankAccountNumber) : 'Not provided'}
                  {form.bankAccountNumber && form.bankAccountNumber.length >= 8 && (
                    <button style={styles.showHideBtn} onClick={() => setShowBankAccount(!showBankAccount)}><FontAwesomeIcon icon={faEye} /> {showBankAccount ? 'Hide' : 'Show'}</button>
                  )}
                </>
              )}
            </div>
            {showBankAccount && form.bankAccountNumber && !editMode && <div style={styles.fullAadhaar}>{form.bankAccountNumber}</div>}
          </Field>
          <Field label="Bank Name">
            <Inp editable={editMode} value={form.bankName} onChange={setEditable('bankName')} placeholder="e.g. HDFC Bank, ICICI Bank" />
          </Field>
          <Field label="IFSC Code">
            <Inp editable={editMode} value={form.ifscCode} onChange={setEditable('ifscCode')} placeholder="e.g. HDFC0001234" />
          </Field>
          <Field label="Account Holder Name">
            <Inp editable={editMode} value={form.accountHolderName} onChange={setEditable('accountHolderName')} placeholder="Name on bank account" />
          </Field>
        </Grid2>
      </Section>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}><FontAwesomeIcon icon={icon} style={{ color:'#0E7C86', marginRight:8 }} /><span style={styles.sectionTitle}>{title}</span></div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  )
}

function Grid2({ children }) { return <div style={styles.grid2}>{children}</div> }

function Field({ label, error, children, style, fieldName }) {
  return (
    <div data-field={fieldName} style={{ marginBottom:14, ...style }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <div style={styles.fieldError}>{error}</div>}
    </div>
  )
}

function Inp({ editable, hasError, ...props }) {
  return <input style={iStyle(editable, hasError)} disabled={!editable} {...props} />
}

const selectStyles = {
  control: (provided, state) => ({
    ...provided, width: '100%', padding: '9px 12px', borderRadius: 8,
    border: state.isFocused ? '1.5px solid #0E7C86' : '1.5px solid #e5e7eb',
    background: state.isDisabled ? '#f9fafb' : '#fff',
    color: state.isDisabled ? '#555' : '#111',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    cursor: state.isDisabled ? 'default' : 'auto',
    transition: 'border-color 0.2s', minHeight: 'unset',
    '&:hover': { borderColor: '#0E7C86' },
  }),
  valueContainer: (provided) => ({ ...provided, padding: 0 }),
  input: (provided) => ({ ...provided, margin: 0, padding: 0 }),
  placeholder: (provided) => ({ ...provided, color: '#64748b' }),
  singleValue: (provided) => ({ ...provided, color: '#111' }),
}

const iStyle = (editable, hasError) => ({
  width:'100%', padding:'9px 12px', borderRadius:8,
  border: hasError ? '1.5px solid #ef4444' : editable ? '1.5px solid #0E7C86' : '1.5px solid #e5e7eb',
  background: editable ? '#fff' : '#f9fafb',
  color: editable ? '#111' : '#555',
  fontSize:14, outline:'none', boxSizing:'border-box',
  cursor: editable ? 'auto' : 'default', transition:'border-color 0.2s',
})

const styles = {
  page:         { fontFamily:"'DM Sans','Segoe UI',sans-serif", maxWidth:960, margin:'0 auto', padding:'24px 20px', background:'#f4f6f9', minHeight:'100vh', color:'#111' },
  topBar:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 },
  pageTitle:    { margin:0, fontSize:24, fontWeight:800, color:'#0f172a' },
  pageSubtitle: { margin:'4px 0 0', fontSize:13.5, color:'#64748b' },
  topActions:   { display:'flex', gap:10, alignItems:'center' },
  btnEdit:   { display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:8, border:'1.5px solid #0E7C86', background:'#fff', color:'#0E7C86', fontWeight:600, fontSize:14, cursor:'pointer' },
  btnCancel: { display:'flex', alignItems:'center', gap:7, padding:'9px 18px', borderRadius:8, border:'1.5px solid #d1d5db', background:'#fff', color:'#555', fontWeight:600, fontSize:14, cursor:'pointer' },
  btnSave:   { display:'flex', alignItems:'center', gap:7, padding:'9px 22px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#0E7C86,#6C3FC5)', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' },
  toastSuccess: { background:'#f0fdf4', border:'1px solid #bbf7d0', borderLeft:'4px solid #10b981', borderRadius:8, padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:500 },
  toastError:   { background:'#fef2f2', border:'1px solid #fecaca', borderLeft:'4px solid #ef4444', borderRadius:8, padding:'12px 18px', marginBottom:16, fontSize:14, fontWeight:500 },
  hero:         { background:'linear-gradient(135deg,#0d4f5c 0%,#1a1a3e 100%)', borderRadius:16, padding:'24px 28px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:20 },
  heroLeft:     { display:'flex', alignItems:'center', gap:18 },
  avatar:       { width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#0E7C86,#6C3FC5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:800, color:'#fff', flexShrink:0 },
  heroName:     { fontWeight:800, fontSize:22, color:'#fff', marginBottom:2 },
  heroRole:     { color:'#1AA8B5', fontSize:13, marginBottom:8 },
  heroMeta:     { display:'flex', gap:20, flexWrap:'wrap' },
  heroMetaItem: { display:'flex', alignItems:'center', gap:6, color:'rgba(255,255,255,0.7)', fontSize:12.5 },
  heroStats:    { display:'flex', gap:28, flexWrap:'wrap', alignSelf:'flex-end' },
  statItem:     { textAlign:'center' },
  statVal:      { fontWeight:800, fontSize:20, color:'#F4A130' },
  statLabel:    { color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:2 },
  section:      { background:'#fff', borderRadius:14, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', marginBottom:18, overflow:'visible' },
  sectionHeader:{ padding:'14px 22px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center' },
  sectionTitle: { fontWeight:700, fontSize:15.5, color:'#0f172a' },
  sectionBody:  { padding:'20px 22px', overflow:'visible' },
  grid2:        { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'0 24px', overflow:'visible' },
  label:        { display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' },
  fieldError:   { fontSize:12, color:'#ef4444', marginTop:4 },
  fieldHint:    { fontSize:11, color:'#94a3b8', marginTop:4 },
  chips:        { display:'flex', flexWrap:'wrap', gap:8, marginTop:6 },
  chip:         { padding:'6px 14px', borderRadius:20, border:'1.5px solid #e2e8f0', fontSize:13, color:'#64748b', cursor:'pointer', userSelect:'none' },
  chipActive:   { padding:'6px 14px', borderRadius:20, border:'1.5px solid #0E7C86', background:'#e6f6f7', fontSize:13, color:'#0E7C86', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', userSelect:'none' },
  resumeBox:    { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'28px', border:'2px dashed #0E7C86', borderRadius:12, cursor:'pointer', background:'#f0fafa', textAlign:'center' },
  resumeDisplay:{ padding:'12px 16px', borderRadius:8, background:'#f8fafc', border:'1px solid #e2e8f0', fontSize:14, color:'#334155', display:'flex', alignItems:'center', gap:8 },
  documentDisplayWithActions: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderRadius:8, background:'#f8fafc', border:'1px solid #e2e8f0', gap:12, flexWrap:'wrap' },
  documentInfo:  { display:'flex', alignItems:'center', gap:8, flex:1 },
  documentPreview:{ width:'100%', maxWidth:240, borderRadius:10, border:'1px solid #e2e8f0', marginTop:12, objectFit:'cover' },
  downloadBtn:   { display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:6, background:'#0E7C86', color:'#fff', border:'none', cursor:'pointer', fontSize:12, fontWeight:600 },
  maskedValue:  { display:'flex', alignItems:'center', gap:12, padding:'9px 12px', borderRadius:8, background:'#f9fafb', border:'1.5px solid #e5e8eb', fontSize:14, justifyContent:'space-between' },
  showHideBtn:  { background:'none', border:'none', color:'#0E7C86', cursor:'pointer', fontSize:12, fontWeight:600, display:'flex', alignItems:'center', gap:4 },
  fullAadhaar:  { marginTop:8, fontSize:13, color:'#1f2937', fontWeight:500, padding:'8px 12px', background:'#e6f6f7', borderRadius:6, display:'inline-block' },
  emptyHint:    { fontSize:13, color:'#94a3b8', fontStyle:'italic' },
  separator:    { height:1, background:'#e2e8f0', margin:'20px 0' },
  warningBox:   { background:'#FEF3C7', borderRadius:8, padding:'12px 16px', display:'flex', alignItems:'center', flexWrap:'wrap' },
}