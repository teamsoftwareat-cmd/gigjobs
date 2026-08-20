import React, { useEffect, useRef } from 'react'
import { components } from 'react-select'
import CreatableSelect from 'react-select/creatable'
import MultiSelectDropdown from '../Common/MultiSelectDropdown'
import { LoadingOverlay } from '../ui'
import { step4EmploymentSchema } from '../../schemas/validations'

const isFilled = (value) => String(value || '').trim().length > 0

const statusOptions = [
  { value: 'Student', label: 'Student' },
  { value: 'Working', label: 'Working' },
  { value: 'Fresher', label: 'Fresher' },
  { value: 'Other', label: 'Other' },
]

const TRAVEL_DISTANCE_OPTIONS = [
  { value: '5 km', label: 'Up to 5 km' },
  { value: '10 km', label: 'Up to 10 km' },
  { value: '15 km', label: 'Up to 15 km' },
  { value: '20 km', label: 'Up to 20 km' },
  { value: '30 km', label: 'Up to 30 km' },
  { value: '50 km', label: 'Up to 50 km' }
]

const JOB_TYPE_OPTIONS = [
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Night Shift', label: 'Night Shift' },
  { value: 'Day Shift', label: 'Day Shift' },
  { value: 'Work from Home', label: 'Work from Home' },
  { value: 'Contract', label: 'Contract' }
]

const SHIFT_OPTIONS = [
  { value: 'Morning', label: 'Morning' },
  { value: 'Evening', label: 'Evening' },
  { value: 'Night', label: 'Night' },
  { value: 'Flexible', label: 'Flexible' }
]

const Step4Employment = ({ isActive, formData, updateFormData, onNext, onPrev, showToast }) => {
  const travelDistances = TRAVEL_DISTANCE_OPTIONS
  const jobTypes = JOB_TYPE_OPTIONS
  const shifts = SHIFT_OPTIONS
  const loading = false

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

  const toastRef = useRef(showToast)

  useEffect(() => {
    toastRef.current = showToast
  }, [showToast])

  useEffect(() => {
    if (isActive && (!formData.expectedDailyRate || formData.expectedDailyRate === '')) {
      updateFormData({ expectedDailyRate: '0' })
    }
  }, [isActive, formData.expectedDailyRate, updateFormData])

  const handleTravelDistanceChange = (selected) => {
    updateFormData({ travelDistance: selected ? selected.value : '' })
  }

  const handleJobTypesChange = (selected) => {
    const values = selected ? selected.map(s => s.value) : []
    updateFormData({ jobTypes: values })
  }

  const handleShiftChange = (selected) => {
    updateFormData({ shiftPreference: selected ? selected.value : '' })
  }

  const detailsLabel = (() => {
    switch (formData.currentStatus) {
      case 'Student':
        return 'Current course / internship details *'
      case 'Working':
        return 'Previous work details *'
      case 'Other':
        return 'Please describe your current status *'
      default:
        return 'Previous work details'
    }
  })()

  const detailsPlaceholder = (() => {
    switch (formData.currentStatus) {
      case 'Student':
        return 'Enter your current study program, institution, or internship details'
      case 'Working':
        return 'Enter your previous roles, industries, or experience highlights'
      case 'Other':
        return 'Describe your current employment status or availability'
      default:
        return 'Enter your previous work details or related experience'
    }
  })()

  const handleContinue = () => {
    const result = step4EmploymentSchema.safeParse({
      currentStatus: formData.currentStatus,
      travelDistance: formData.travelDistance,
      jobTypes: formData.jobTypes || [],
      shiftPreference: formData.shiftPreference,
      expectedDailyRate: formData.expectedDailyRate,
      preferredField: formData.preferredField,
      previousWorkDetails: formData.previousWorkDetails,
      employmentNotes: formData.employmentNotes,
      currentCompany: formData.currentCompany,
      yearsOfExperience: formData.yearsOfExperience,
      currentCTC: formData.currentCTC,
    })

    if (!result.success) {
      const error = result.error.issues[0]
      return showToast('⚠️', error?.message || 'Please fix the errors')
    }

    onNext()
  }

  if (!isActive) return null

  return (
    <div className="reg-step-content active">
      <LoadingOverlay active={loading} message="Loading employment options..." />

      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
        💼 Employment Details
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>
        Share your job preferences so we can match you to the right work.
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">Current Status *</label>
          <CreatableSelect
            options={statusOptions}
            value={formData.currentStatus ? (statusOptions.find(s => s.value === formData.currentStatus) || { label: formData.currentStatus, value: formData.currentStatus }) : null}
            onChange={(selected) => updateFormData({ currentStatus: selected ? selected.value : '' })}
            placeholder="Select current status"
            isClearable
            components={{ DropdownIndicator: CustomDropdownIndicator }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Max Travel Distance *</label>
          <CreatableSelect
            options={travelDistances}
            value={formData.travelDistance ? (travelDistances.find(d => d.value === formData.travelDistance) || { label: formData.travelDistance, value: formData.travelDistance }) : null}
            onChange={handleTravelDistanceChange}
            placeholder="Select travel distance"
            isClearable
            components={{ DropdownIndicator: CustomDropdownIndicator }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Job Type Preference *</label>
          <CreatableSelect
            isMulti
            options={jobTypes}
            value={formData.jobTypes?.map(jt => ({ label: jt, value: jt })) || []}
            onChange={handleJobTypesChange}
            placeholder="Select job types"
            components={{ DropdownIndicator: CustomDropdownIndicator }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Shift Preference *</label>
          <CreatableSelect
            options={shifts}
            value={formData.shiftPreference ? (shifts.find(s => s.value === formData.shiftPreference) || { label: formData.shiftPreference, value: formData.shiftPreference }) : null}
            onChange={handleShiftChange}
            placeholder="Select shift preference"
            isClearable
            components={{ DropdownIndicator: CustomDropdownIndicator }}
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Preferred Work Field / Industry *</label>
          <input
            className="form-control"
            placeholder="e.g. hospitality, logistics, retail, manufacturing"
            value={formData.preferredField || ''}
            onChange={(e) => updateFormData({ preferredField: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Current Company</label>
          <input
            className="form-control"
            placeholder="e.g. ABC Industries Ltd."
            value={formData.currentCompany || ''}
            onChange={(e) => updateFormData({ currentCompany: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Years of Experience</label>
          <input
            className="form-control"
            type="number"
            placeholder="e.g. 3.5"
            value={formData.yearsOfExperience || ''}
            onChange={(e) => updateFormData({ yearsOfExperience: e.target.value })}
            step="0.1"
            min="0"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Current CTC</label>
          <input
            className="form-control"
            placeholder="e.g. 3,50,000"
            value={formData.currentCTC || ''}
            onChange={(e) => updateFormData({ currentCTC: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">{detailsLabel}</label>
          <textarea
            className="form-control"
            placeholder={detailsPlaceholder}
            rows="4"
            value={formData.previousWorkDetails || ''}
            onChange={(e) => updateFormData({ previousWorkDetails: e.target.value })}
          />
        </div>

      </div>

      <div className="action-row">
        <button className="btn btn-secondary btn-sm" onClick={onPrev}>
          Back
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleContinue}>
          Continue
        </button>
      </div>
    </div>
  )
}

export default Step4Employment
