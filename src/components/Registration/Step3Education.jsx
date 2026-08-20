import React, { useEffect, useRef } from 'react'
import { components } from 'react-select'
import CreatableSelect from 'react-select/creatable'
import MultiSelectDropdown from '../Common/MultiSelectDropdown'
import FileUpload from '../ui/FileUpload'
import { LoadingOverlay } from '../ui'
import { step3EducationSchema } from '../../schemas/validations'

const isFilled = (value) => String(value || '').trim().length > 0

const EDUCATION_LEVEL_OPTIONS = [
  { label: '10th Pass', value: '10th Pass' },
  { label: '12th Pass', value: '12th Pass' },
  { label: 'Diploma', value: 'Diploma' },
  { label: 'Graduate', value: 'Graduate' },
  { label: 'Postgraduate', value: 'Postgraduate' }
]

const SKILL_OPTIONS = [
  { label: 'Customer Service', value: 'Customer Service' },
  { label: 'Sales', value: 'Sales' },
  { label: 'Data Entry', value: 'Data Entry' },
  { label: 'Delivery', value: 'Delivery' },
  { label: 'Driving', value: 'Driving' },
  { label: 'Housekeeping', value: 'Housekeeping' },
  { label: 'Computer Operator', value: 'Computer Operator' },
  { label: 'Field Work', value: 'Field Work' },
  { label: 'Teaching', value: 'Teaching' },
  { label: 'Healthcare', value: 'Healthcare' }
]

const COLLEGE_OPTIONS = [
]

const DEGREE_OPTIONS = [
  { label: 'B.A.', value: 'B.A.' },
  { label: 'B.Sc.', value: 'B.Sc.' },
  { label: 'B.Com.', value: 'B.Com.' },
  { label: 'B.Tech.', value: 'B.Tech.' },
  { label: 'M.A.', value: 'M.A.' },
  { label: 'M.Sc.', value: 'M.Sc.' },
  { label: 'M.Com.', value: 'M.Com.' },
  { label: 'MBA', value: 'MBA' },
  { label: 'Diploma', value: 'Diploma' }
]

const Step3Education = ({ isActive, formData, updateFormData, onNext, onPrev, showToast }) => {
  const educationLevels = EDUCATION_LEVEL_OPTIONS
  const skills = SKILL_OPTIONS
  const colleges = COLLEGE_OPTIONS
  const degrees = DEGREE_OPTIONS
  const isBiharState = String(formData.state || '').trim() === 'Bihar'
  const loading = false

  const selectInputs = useRef({})
  const handleInputChange = (field) => (v, { action }) => { if (action === 'input-change') selectInputs.current[field] = v }
  const handleSelectBlur = (field, isMulti = false) => () => {
    const val = selectInputs.current[field]
    if (val) {
      if (isMulti) {
        const current = formData[field] || []
        if (!current.includes(val)) updateFormData({ [field]: [...current, val] })
      } else {
        updateFormData({ [field]: val })
      }
      selectInputs.current[field] = ''
    }
  }

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

  const handleEducationChange = (selected) => {
    updateFormData({ education: selected ? selected.value : '' })
  }

  const handleCollegeChange = (selected) => {
    updateFormData({ college: selected ? selected.value : '' })
  }

  const handleDegreeChange = (selected) => {
    updateFormData({ degree: selected ? selected.value : '' })
  }

  const handleSkillsChange = (selected) => {
    const values = selected ? selected.map(s => s.value) : []
    updateFormData({ skills: values })
  }

  const handleFilesChange = (files) => {
    const file = files[0] || null

    // Hard cap for resume file size to ensure the final registration POST doesn't hang on slow mobile networks.
    if (file && file.size > 2 * 1024 * 1024) {
      return showToast('⚠️', 'Resume too large. Please upload a file smaller than 2MB.')
    }

    updateFormData({ resume: file })
    if (file && toastRef.current) {
      toastRef.current('✅', 'Resume added successfully')
    }
  }

  const handleContinue = () => {
    const result = step3EducationSchema.safeParse({
      education: formData.education,
      customEducation: formData.customEducation,
      college: formData.college,
      degree: formData.degree,
      completionYear: formData.completionYear,
      skills: formData.skills || [],
      customSkills: formData.customSkills,
      resume: formData.resume,
    })

    if (!result.success) {
      const error = result.error.issues[0]
      return showToast('⚠️', error?.message || 'Please fix the highlighted fields')
    }

    onNext()
  }

  if (!isActive) return null

  return (
    <div className="reg-step-content active">
      <LoadingOverlay active={loading} message="Loading education options..." />

      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
        🎓 Education & Skills
      </div>
      <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '20px' }}>
        Your background helps us find better gig matches
      </div>

      <div className="form-grid">
        {!isBiharState && (
          <div className="form-group">
            <label className="form-label">Highest Education *</label>
            <CreatableSelect
              options={educationLevels}
              value={formData.education ? (educationLevels.find(e => e.value === formData.education) || { label: formData.education, value: formData.education }) : null}
              onChange={handleEducationChange}
              onInputChange={handleInputChange('education')}
              onBlur={handleSelectBlur('education')}
              placeholder="Select education level"
              isClearable
              components={{ DropdownIndicator: CustomDropdownIndicator }}
            />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">College / Institution *</label>
            <CreatableSelect
              options={colleges}
              value={formData.college ? (colleges.find(c => c.value === formData.college) || { label: formData.college, value: formData.college }) : null}
              onChange={handleCollegeChange}
              onInputChange={handleInputChange('college')}
              onBlur={handleSelectBlur('college')}
              placeholder="Select college"
              isClearable
              components={{ DropdownIndicator: CustomDropdownIndicator }}
            />
        </div>
        <div className="form-group">
          <label className="form-label">Degree / Course</label>
            <CreatableSelect
              options={degrees}
              value={formData.degree ? (degrees.find(d => d.value === formData.degree) || { label: formData.degree, value: formData.degree }) : null}
              onChange={handleDegreeChange}
              onInputChange={handleInputChange('degree')}
              onBlur={handleSelectBlur('degree')}
              placeholder="Select degree"
              isClearable
              components={{ DropdownIndicator: CustomDropdownIndicator }}
            />
        </div>
        <div className="form-group">
          <label className="form-label">Year of Completion *</label>
          <input
            className="form-control"
            type="month"
            placeholder="Select month and year"
            min="1950-01"
            max={`${new Date().getFullYear()}-12`}
            value={formData.completionYear || ''}
            onChange={(e) => updateFormData({ completionYear: e.target.value })}
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Your Skills * <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(select all that apply)</span>
        </label>
        <CreatableSelect
          isMulti
          options={skills}
          value={formData.skills?.map(s => ({ label: s, value: s })) || []}
          onChange={handleSkillsChange}
          onInputChange={handleInputChange('skills')}
          onBlur={handleSelectBlur('skills', true)}
          placeholder="Type and press Enter to add skills"
          components={{ DropdownIndicator: CustomDropdownIndicator }}
        />
        <div style={{ fontSize: '12px', color: '#8899AA', marginTop: '5px' }}>
          Type a skill and press Enter to add, or select from dropdown
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Resume / CV (Optional)</label>
        <FileUpload
          accept=".pdf,.doc,.docx"
          onFilesChange={handleFilesChange}
          placeholder="Upload your Resume"
          helperText="Supports PDF, DOC, DOCX · Max 5MB"
        />
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

export default Step3Education
