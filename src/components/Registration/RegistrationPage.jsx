import React, { useState, useEffect, useRef } from 'react'
import Step1Mobile from './Step1Mobile'
import Step2Profile from './Step2Profile'
import Step3Education from './Step3Education'
import Step4Employment from './Step4Employment'
import Step5KYC from './Step5KYC'
import { authAPI } from '../../api/axios'
import { LoadingOverlay } from '../ui'
import {
  step1MobileSchema,
  step2ProfileSchema,
  step3EducationSchema,
  step4EmploymentSchema,
  step5KYCSchema,
} from '../../schemas/validations'
import './RegistrationPage.css'

const isFilled = (value) => String(value || '').trim().length > 0
const isValidEmail = (value) => /.+@.+\..+/.test(String(value || '').trim())
const digitsOnly = (value) => String(value || '').replace(/\D/g, '')

const isStep1Complete = (data) => step1MobileSchema.safeParse({ mobile: data.mobile, referralCode: data.referralCode }).success

const isStep2Complete = (data) =>
  step2ProfileSchema.safeParse({
    firstName: data.firstName,
    lastName: data.lastName,
    fatherName: data.fatherName,
    dob: data.dob,
    gender: data.gender,
    education: data.education,
    email: data.email,
    whatsapp: data.whatsapp,
    presentAddress: data.presentAddress,
    permanentAddress: data.permanentAddress,
    pincode: data.pincode,
    digipin: data.digipin,
    area: data.area,
    customArea: data.customArea,
    languages: data.languages || [],
    customLanguages: data.customLanguages,
    jobTypes: data.jobTypes,
    customJobTypes: data.customJobTypes,
  }).success

const isStep3Complete = (data) =>
  step3EducationSchema.safeParse({
    education: data.education,
    customEducation: data.customEducation,
    college: data.college,
    degree: data.degree,
    completionYear: data.completionYear,
    skills: data.skills || [],
    customSkills: data.customSkills,
    resume: data.resume,
  }).success

const isStep4Required = (data) => data.state === 'Tamil Nadu'

const isStep4Complete = (data) => {
  if (!isStep4Required(data)) return true
  return step4EmploymentSchema.safeParse({
    currentStatus: data.currentStatus,
    travelDistance: data.travelDistance,
    jobTypes: data.jobTypes || [],
    shiftPreference: data.shiftPreference,
    expectedDailyRate: data.expectedDailyRate,
    preferredField: data.preferredField,
    previousWorkDetails: data.previousWorkDetails,
    employmentNotes: data.employmentNotes,
    currentCompany: data.currentCompany,
    yearsOfExperience: data.yearsOfExperience,
    currentCTC: data.currentCTC,
  }).success
}

const isStep5Complete = (data) =>
  step5KYCSchema.safeParse({
    aadhaarNumber: digitsOnly(data.aadhaarNumber),
    aadhaarNumberConfirm: digitsOnly(data.aadhaarNumberConfirm),
    panNumber: data.panNumber,
    bankAccount: data.bankAccount,
    ifscCode: data.ifscCode,
    bankName: data.bankName,
    accountHolderName: data.accountHolderName,
    profilePhoto: data.profilePhoto,
    aadhaarFront: data.aadhaarFront,
    aadhaarBack: data.aadhaarBack,
  }).success

const getFirstIncompleteStep = (data) => {
  if (!isStep1Complete(data)) return 1
  if (!isStep2Complete(data)) return 2
  if (String(data.state || '').trim() === 'Bihar') return 3
  if (!isStep3Complete(data)) return 3
  if (!isStep4Complete(data)) return 4
  if (!isStep5Complete(data)) return 5
  return 5
}

const dataURLToBlob = (dataUrl) => {
  const [header, base64] = dataUrl.split(',')
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const appendField = (payload, key, value) => {
  if (value === null || value === undefined || value === '') return
  if (typeof value === 'string' && value.startsWith('data:image/')) {
    // Aggressively cap final payload size by ensuring all stored images are sent as small JPEGs
    payload.append(key, dataURLToBlob(value), `${key}.jpg`)
    return
  }
  payload.append(key, value)
}

const RegistrationPage = ({ showToast }) => {
  const submitInFlightRef = useRef(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [registrationId, setRegistrationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [formData, setFormData] = useState({
    mobile: '',
    referralCode: '',
    otpVerified: false,
    registrationId: null,
    firstName: '',
    lastName: '',
    fatherName: '',
    dob: '',
    gender: '',
    email: '',
    emailVerified: false,
    emailVerificationSkipped: false,
    whatsapp: '',
    address: '',
    pincode: '',
    digipin: '',
    area: '',
    travelDistance: '',
    languages: [],
    jobTypes: [],
    education: '',
    college: '',
    degree: '',
    completionYear: '',
    skills: [],
    shiftPreference: '',
    expectedDailyRate: '0',
    preferredField: '',
    employmentNotes: '',
    resume: null,
    aadhaarNumber: '',
    panNumber: '',
    bankAccount: '',
    ifscCode: '',
    bankName: '',
    accountHolderName: '',
    profilePhoto: '',
    aadhaarFront: '',
    aadhaarBack: '',
    faceId: '',
    state: '',
  })

  const isBiharState = String(formData.state || '').trim() === 'Bihar'
  const shouldShowStep4 = formData.state === 'Tamil Nadu'
  const totalSteps = isBiharState ? 3 : shouldShowStep4 ? 5 : 4
  const stepTitles = isBiharState
    ? ['Mobile', 'Profile', 'KYC']
    : shouldShowStep4
      ? ['Mobile', 'Profile', 'Education', 'Employment', 'KYC']
      : ['Mobile', 'Profile', 'Education', 'KYC']
  const kycStep = isBiharState ? 3 : shouldShowStep4 ? 5 : 4

  useEffect(() => {
    const savedData = localStorage.getItem('registration_progress')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        const merged = { ...formData, ...parsed }
        setFormData(merged)
        if (parsed.registrationId) setRegistrationId(parsed.registrationId)
        const savedStep = parsed.currentStep || 1
        const firstIncompleteStep = getFirstIncompleteStep(merged)
        setCurrentStep(Math.min(savedStep, firstIncompleteStep))
      } catch (error) {
        console.error('Failed to restore registration progress', error)
        setCurrentStep(1)
      }
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps)
    }
  }, [totalSteps, currentStep])

  useEffect(() => {
    const {
      resume,
      profilePhoto,
      aadhaarFront,
      aadhaarBack,
      ...dataWithoutFiles
    } = formData

    const saveData = {
      ...dataWithoutFiles,
      currentStep,
      registrationId,
    }
    localStorage.setItem('registration_progress', JSON.stringify(saveData))
  }, [formData, currentStep, registrationId])

  const updateFormData = (updates) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    setCurrentStep((prev) => {
      if (isBiharState) {
        if (prev === 2) return 3
        return Math.min(prev + 1, totalSteps)
      }
      if (prev === 3 && !shouldShowStep4) return 4
      return Math.min(prev + 1, totalSteps)
    })
  }

  const prevStep = () => {
    setCurrentStep((prev) => {
      if (isBiharState) {
        if (prev === 3) return 2
        return Math.max(prev - 1, 1)
      }
      if (prev === 4 && !shouldShowStep4) return 3
      return Math.max(prev - 1, 1)
    })
  }

  const completeRegistration = async () => {
    if (submitInFlightRef.current) return

    try {
      submitInFlightRef.current = true
      setCompleting(true)
      const payload = new FormData()

      // Add registration metadata
      payload.append('registration_id', registrationId)
      payload.append('otpVerified', String(formData.otpVerified))
      payload.append('faceId', formData.faceId)

      // Standard fields: Automatically handle strings, arrays, and files
      Object.entries(formData).forEach(([key, value]) => {
        if (key === 'registrationId' || key === 'otpVerified') return // handled above
        if (Array.isArray(value)) {
          appendField(payload, key, JSON.stringify(value))
        } else {
          appendField(payload, key, value)
        }
      })

      await authAPI.completeRegistration(payload)
      localStorage.removeItem('registration_progress')
      setTimeout(() => window.location.assign('https://cynosurejobs.net/gigjobs'), 2000)
    } catch (error) {
      console.error('Registration submission failed', error)
      submitInFlightRef.current = false
      setCompleting(false)
    }
  }

  const getProgressWidth = () => {
    return (currentStep / totalSteps) * 100
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Loading registration data...</p>
      </div>
    )
  }

  return (
    <div className="reg-dedicated">
      <div className="reg-wrap">
        <div className="reg-left">
          <div className="rl-tag">
            <i className="fas fa-map-marker-alt"></i> Greater Chennai
          </div>
          <div className="rl-title">
            Join <span>50,000+</span> Gig Workers
          </div>
          <div className="rl-sub">
            Register once, work anywhere in Chennai. Internships, part-time and temporary roles across 500+ companies. Get paid weekly, directly to your bank.
          </div>

          <div className="rl-benefits">
            <div className="rl-benefit">
              <div className="rl-b-icon" style={{ background: 'rgba(14,124,134,0.25)' }}>💸</div>
              <div>
                <div className="rl-b-title">Direct Bank Payouts</div>
                <div className="rl-b-desc">Earnings credited every week</div>
              </div>
            </div>
            <div className="rl-benefit">
              <div className="rl-b-icon" style={{ background: 'rgba(244,161,48,0.2)' }}>🎯</div>
              <div>
                <div className="rl-b-title">AI-Matched Jobs</div>
                <div className="rl-b-desc">Smart recommendations based on your skills & location</div>
              </div>
            </div>
            <div className="rl-benefit">
              <div className="rl-b-icon" style={{ background: 'rgba(27,158,92,0.2)' }}>✅</div>
              <div>
                <div className="rl-b-title">KYC in 5 Minutes</div>
                <div className="rl-b-desc">Aadhaar + PAN verification, fully digital</div>
              </div>
            </div>
            <div className="rl-benefit">
              <div className="rl-b-icon" style={{ background: 'rgba(108,63,197,0.2)' }}>📱</div>
              <div>
                <div className="rl-b-title">Mobile Attendance</div>
                <div className="rl-b-desc">Geo-fenced clock-in with selfie — no paperwork</div>
              </div>
            </div>
          </div>

          <div className="rl-stats">
            <div>
              <div className="rl-stat-val">5L+</div>
              <div className="rl-stat-lbl">Candidates</div>
            </div>
            <div>
              <div className="rl-stat-val">500+</div>
              <div className="rl-stat-lbl">Companies</div>
            </div>
            <div>
              <div className="rl-stat-val">₹800</div>
              <div className="rl-stat-lbl">Avg Daily Rate</div>
            </div>
          </div>
        </div>

        <div className="reg-right">
          <div className="reg-form-header">
            <div className="rfh-title">Create Your Account</div>
            <div className="rfh-sub">Complete all {totalSteps} steps to start applying for gig jobs</div>
          </div>

          <div className="mobile-header-banner">
            <div className="mobile-banner-title">Fast mobile registration</div>
            <div className="mobile-banner-note">Only what we need: phone, profile, education, work details, and KYC.</div>
          </div>

          <div className="reg-progress-bar">
            <div className="reg-progress-fill" style={{ width: `${getProgressWidth()}%` }}></div>
          </div>

          <div className="mobile-step-summary">
            <div className="mobile-step-index">Step {currentStep} of {totalSteps}</div>
            <div className="mobile-step-title">{stepTitles[currentStep - 1]}</div>
          </div>

          <div className="step-indicator">
            {Array.from({ length: totalSteps }, (_, idx) => idx + 1).map((step) => (
              <div
                key={step}
                className={`step ${currentStep > step ? 'done' : ''} ${currentStep === step ? 'active' : ''}`}
                style={{ cursor: 'default' }}
                aria-disabled="true"
              >
                <div className="step-dot">{step}</div>
                <div className="step-lbl">{stepTitles[step - 1]}</div>
              </div>
            ))}
          </div>

          <Step1Mobile
            isActive={currentStep === 1}
            formData={formData}
            updateFormData={updateFormData}
            showToast={showToast}
            onNext={nextStep}
            setRegistrationId={setRegistrationId}
          />

          <Step2Profile
            isActive={currentStep === 2}
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onPrev={prevStep}
            showToast={showToast}
          />

          <Step3Education
            isActive={currentStep === 3 && !isBiharState}
            formData={formData}
            updateFormData={updateFormData}
            onNext={nextStep}
            onPrev={prevStep}
            showToast={showToast}
          />

          {shouldShowStep4 && (
            <Step4Employment
              isActive={currentStep === 4 && !isBiharState}
              formData={formData}
              updateFormData={updateFormData}
              onNext={nextStep}
              onPrev={prevStep}
              showToast={showToast}
            />
          )}

          <Step5KYC
            isActive={currentStep === kycStep}
            formData={formData}
            updateFormData={updateFormData}
            onPrev={prevStep}
            onSubmit={completeRegistration}
            showToast={showToast}
            isSubmitting={completing}
          />

          <LoadingOverlay active={completing} message="Finalizing your registration..." />
        </div>
      </div>
    </div>
  )
}

export default RegistrationPage
