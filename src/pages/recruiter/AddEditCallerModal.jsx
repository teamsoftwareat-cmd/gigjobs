import { useState, useEffect, useCallback, useRef } from 'react'
import { Modal, FormField } from '../../components/ui/index'
import AllocateRecipientsModal from './AllocateRecipientsModal'
import { recruiterAPI } from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const DEFAULT_ASSIGNMENT = {
  projectType: 'regular',
  project: '',
  location: '',
  district: '',
  centre: '',
  recipientCount: 0,
  allocatedRecipients: []
}

export default function AddEditCallerModal({ isOpen, onClose, onSaved, initialData = null }) {
  const { user } = useAuth()
  const [form, setForm] = useState({ registrationId: '', name: '', phone: '', email: '', projectLocations: [{ ...DEFAULT_ASSIGNMENT }], status: 'active' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [projectOptions, setProjectOptions] = useState({ regular: [], written: [] })
  const [locationOptions, setLocationOptions] = useState([[]])
  const [districtOptions, setDistrictOptions] = useState([[]])
  const [centreOptions, setCentreOptions] = useState([[]])
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [allocateData, setAllocateData] = useState(null)
  const [callerDetailsLoading, setCallerDetailsLoading] = useState(false);
  const [candidateSuggestions, setCandidateSuggestions] = useState([])
  const [candidateLoading, setCandidateLoading] = useState(false)
  const [debouncedPhone, setDebouncedPhone] = useState('')
  const [showCandidateSuggestions, setShowCandidateSuggestions] = useState(false)
  const suggestionsRef = useRef(null)

  // Handle click outside suggestions to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
        setShowCandidateSuggestions(false)
      }
    }
    if (showCandidateSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCandidateSuggestions])

  const setLocationOptionsAt = useCallback((index, options) => {
    setLocationOptions(prev => {
      const next = [...prev]
      next[index] = options
      return next
    })
  }, [])

  const setDistrictOptionsAt = useCallback((index, options) => {
    setDistrictOptions(prev => {
      const next = [...prev]
      next[index] = options
      return next
    })
  }, [])

  const setCentreOptionsAt = useCallback((index, options) => {
    setCentreOptions(prev => {
      const next = [...prev]
      next[index] = options
      return next
    })
  }, [])

  const updateProjectLocation = useCallback((index, field, value) => {
    setForm(prev => ({
      ...prev,
      projectLocations: prev.projectLocations.map((pl, i) =>
        i === index ? { ...pl, [field]: value } : pl
      )
    }))
  }, []);

  const fetchRecipientCount = useCallback(async (projectType, project, location, district, centre, index) => {
    if (!project) return;

    const params = { project }
    if (projectType === 'written') {
      if (!district || !centre) return
      params.district = district
      params.centre = centre
    } else {
      if (!location) return
      params.location = location
    }

    try {
      const resp = await recruiterAPI.getRecipientCount(params);
      const count = resp.data?.count || resp.data?.data?.count || 0;
      updateProjectLocation(index, 'recipientCount', count);
    } catch (err) {
      console.error('Failed to fetch recipient count:', err);
      updateProjectLocation(index, 'recipientCount', 0);
    }
  }, [updateProjectLocation]);

  const fetchCallerDetails = useCallback(async (callerId) => {
    setCallerDetailsLoading(true);
    try {
      const response = await recruiterAPI.getCallerById(callerId);
      const data = response.data?.data || response.data;

      if (data) {
        let projectLocations = []
        const locations = Array.isArray(data.location) ? data.location.map(String) : (data.location ? [String(data.location)] : [])

        if (Array.isArray(data.project_locations)) {
          projectLocations = data.project_locations.map(pl => {
            const project = String(pl.project ?? '')
            const location = String(pl.location ?? '')
            const district = String(pl.district ?? pl.districtId ?? pl.district_id ?? '')
            const centre = String(pl.centre ?? pl.centreId ?? pl.centre_id ?? pl.center ?? pl.centerId ?? pl.center_id ?? '')
            const projectType = String(pl.projectType ?? pl.project_type ?? (district || centre ? 'written' : 'regular')).toLowerCase() === 'written' ? 'written' : 'regular'

            return {
              projectType,
              project,
              location,
              district,
              centre,
              recipientCount: 0,
              allocatedRecipients: Array.isArray(pl.recipient_ids) ? pl.recipient_ids.map(String) : []
            }
          })
        } else {
          const projects = Array.isArray(data.projects) ? data.projects.map(String) : (data.projects ? String(data.projects).split(',').map(s => s.trim()) : [])
          projectLocations = projects.map((project, index) => ({
            ...DEFAULT_ASSIGNMENT,
            project,
            location: locations[index] || ''
          }))
        }

        if (projectLocations.length === 0 && locations.length > 0) {
          locations.forEach(location => {
            projectLocations.push({ ...DEFAULT_ASSIGNMENT, location })
          })
        }

        if (projectLocations.length === 0) {
          projectLocations.push({ ...DEFAULT_ASSIGNMENT })
        }

        setForm({
          registrationId: String(data.registration_id ?? data.registrationId ?? data.calling_team_login_id ?? data.id ?? data.candidate_id ?? data.candidateId ?? '') || '',
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          projectLocations,
          status: data.status || 'active'
        })

        setTimeout(() => {
          projectLocations.forEach((pl, index) => {
            if (pl.projectType === 'written' && pl.project && pl.district && pl.centre) {
              fetchRecipientCount(pl.projectType, pl.project, '', pl.district, pl.centre, index)
            } else if (pl.project && pl.location) {
              fetchRecipientCount(pl.projectType, pl.project, pl.location, '', '', index)
            }
          })
        }, 100)
      }
    } catch (err) {
      console.error('Failed to fetch caller details:', err);
      setError('Failed to load caller details.');
    } finally {
      setCallerDetailsLoading(false);
    }
  }, [fetchRecipientCount]);

  useEffect(() => {
    if (isOpen) {
      setCandidateSuggestions([])
      setShowCandidateSuggestions(false)
      const identifier = initialData?.calling_team_login_id || initialData?.id;
      if (identifier) {
        // Pre-populate form with available initialData to ensure UX is smooth while full details load
        setForm(prev => ({
          ...prev,
          registrationId: String(initialData.registration_id ?? initialData.registrationId ?? identifier ?? ''),
          name: initialData.name || '',
          phone: initialData.phone || '',
          email: initialData.email || '',
          projectLocations: [{ ...DEFAULT_ASSIGNMENT }],
          status: initialData.status || 'active'
        }))
        fetchCallerDetails(identifier)
      } else {
        setForm({ registrationId: '', name: '', phone: '', email: '', projectLocations: [{ ...DEFAULT_ASSIGNMENT }], status: 'active' })
      }
    }
  }, [isOpen, initialData?.id, fetchCallerDetails]);

  const normalizeCandidateItems = (payload) => {
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : Array.isArray(payload?.data?.candidates)
          ? payload.data.candidates
          : Array.isArray(payload?.data?.results)
            ? payload.data.results
            : Array.isArray(payload?.items)
              ? payload.items
              : Array.isArray(payload?.candidates)
                ? payload.candidates
                : Array.isArray(payload?.results)
                  ? payload.results
                  : Array.isArray(payload)
                    ? payload
                    : []

    return rawList
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const registrationId = String(item.registration_id ?? item.registrationId ?? item.id ?? item.candidate_id ?? item.candidateId ?? item._id ?? '')
        const mobile = String(item.mobile || item.phone || item.whatsapp || item.contact || item.phone_number || item.mobile_number || '').trim()
        const name = String(item.name || item.fullName || item.candidate_name || item.worker_name || item.username || '').trim()
        const email = String(item.email || item.emailId || item.email_address || '').trim()
        if (!registrationId || !mobile) return null
        return { registrationId, mobile, name, email }
      })
      .filter(Boolean)
  }

  const fetchCandidateSuggestions = useCallback(async (query) => {
    const trimmedQuery = String(query || '').trim()
    if (trimmedQuery.length < 2) {
      setCandidateSuggestions([])
      setShowCandidateSuggestions(false)
      return
    }

    setCandidateLoading(true)
    try {
      const response = await recruiterAPI.getCandidates({ search: trimmedQuery, mobile: trimmedQuery, limit: 10 })
      const payload = response.data?.data ?? response.data ?? {}
      const suggestions = normalizeCandidateItems(payload)
      setCandidateSuggestions(suggestions)
      setShowCandidateSuggestions(true)
    } catch (err) {
      console.error('Candidate lookup failed:', err)
      setCandidateSuggestions([])
      setShowCandidateSuggestions(true)
    } finally {
      setCandidateLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPhone(form.phone || ''), 300)
    return () => clearTimeout(timer)
  }, [form.phone])

  useEffect(() => {
    if (!debouncedPhone.trim() || debouncedPhone.trim().length < 3) {
      setCandidateSuggestions([])
      return
    }

    // CRITICAL FIX: Only fetch suggestions if we don't already have a valid registrationId
    // or if the current phone number has been changed by the user.
    // Since handlePhoneChange clears registrationId, this check prevents 
    // automatic lookups on modal open.
    if (form.registrationId) {
      return
    }

    fetchCandidateSuggestions(debouncedPhone)
  }, [debouncedPhone, form.registrationId, fetchCandidateSuggestions])

  const handlePhoneChange = (value) => {
    setForm((prev) => ({ ...prev, phone: value, registrationId: '', name: '', email: '' }))
    setShowCandidateSuggestions(true)
  }

  const handleCandidateSelect = (candidate) => {
    setForm((prev) => ({
      ...prev,
      phone: candidate.mobile,
      name: candidate.name || prev.name,
      email: candidate.email || prev.email,
      registrationId: candidate.registrationId,
    }))
    setShowCandidateSuggestions(false)
    setCandidateSuggestions([])
  }

  const fetchLocationOptionsForProject = useCallback(async (project, index) => {
    if (!project) {
      setLocationOptionsAt(index, [])
      return
    }

    try {
      const resp = await recruiterAPI.getProjectLocations(project)
      const payload = resp?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.locations)
          ? payload.locations
          : Array.isArray(payload?.location_options)
            ? payload.location_options
            : Array.isArray(payload)
              ? payload
              : []

      const normalized = rawList
        .map((item) => {
          if (!item) return null
          if (typeof item === 'object') {
            const id = String(item.id ?? item.locationId ?? item.value ?? item.key ?? item._id ?? '')
            const name = String(item.name ?? item.location ?? item.label ?? item.value ?? id)
            return id ? { value: id, label: name } : null
          }
          const v = String(item || '')
          return v ? { value: v, label: v } : null
        })
        .filter(Boolean)

      const uniq = []
      const seen = new Set()
      for (const it of normalized) {
        if (!seen.has(it.value)) { seen.add(it.value); uniq.push(it) }
      }
      setLocationOptionsAt(index, uniq)
    } catch (err) {
      setLocationOptionsAt(index, [])
    }
  }, [setLocationOptionsAt])

  const fetchDistrictOptionsForProject = useCallback(async (project, index) => {
    if (!project) {
      setDistrictOptionsAt(index, [])
      return
    }

    try {
      const resp = await recruiterAPI.getProjectDistricts(project)
      const payload = resp?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.districts)
          ? payload.districts
          : Array.isArray(payload?.location_options)
            ? payload.location_options
            : Array.isArray(payload)
              ? payload
              : []

      const normalized = rawList
        .map((item) => {
          if (!item) return null
          if (typeof item === 'object') {
            const id = String(item.id ?? item.districtId ?? item.value ?? item.key ?? item._id ?? item.district ?? '')
            const name = String(item.name ?? item.district ?? item.label ?? item.value ?? id)
            return id ? { value: id, label: name } : null
          }
          const v = String(item || '')
          return v ? { value: v, label: v } : null
        })
        .filter(Boolean)

      const uniq = []
      const seen = new Set()
      for (const it of normalized) {
        if (!seen.has(it.value)) { seen.add(it.value); uniq.push(it) }
      }
      setDistrictOptionsAt(index, uniq)
    } catch (err) {
      setDistrictOptionsAt(index, [])
    }
  }, [setDistrictOptionsAt])

  const fetchCentreOptionsForProject = useCallback(async (project, district, index) => {
    if (!project || !district) {
      setCentreOptionsAt(index, [])
      return
    }

    try {
      const resp = await recruiterAPI.getDistrictCentres(project, district)
      const payload = resp?.data ?? {}
      const rawList = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.centres)
          ? payload.centres
          : Array.isArray(payload?.data?.centres)
            ? payload.data.centres
            : Array.isArray(payload)
              ? payload
              : []

      const normalized = rawList
        .map((item) => {
          if (!item) return null
          if (typeof item === 'object') {
            const id = String(item.id ?? item.centreId ?? item.centre_id ?? item.value ?? item.key ?? item._id ?? item.centre ?? item.center ?? '')
            const name = String(item.name ?? item.centre ?? item.label ?? item.value ?? id)
            return id ? { value: id, label: name } : null
          }
          const v = String(item || '')
          return v ? { value: v, label: v } : null
        })
        .filter(Boolean)

      const uniq = []
      const seen = new Set()
      for (const it of normalized) {
        if (!seen.has(it.value)) { seen.add(it.value); uniq.push(it) }
      }
      setCentreOptionsAt(index, uniq)
    } catch (err) {
      setCentreOptionsAt(index, [])
    }
  }, [setCentreOptionsAt])

  useEffect(() => {
    let mounted = true
    const updateOptions = async () => {
      if (!mounted) return
      setLocationOptions(form.projectLocations.map(() => []))
      setDistrictOptions(form.projectLocations.map(() => []))
      setCentreOptions(form.projectLocations.map(() => []))

      await Promise.all(form.projectLocations.map(async (pl, index) => {
        if (!pl.project) return
        if (pl.projectType === 'written') {
          await fetchDistrictOptionsForProject(pl.project, index)
          if (pl.district) {
            await fetchCentreOptionsForProject(pl.project, pl.district, index)
          }
        } else {
          await fetchLocationOptionsForProject(pl.project, index)
        }
      }))
    }
    updateOptions()
    return () => { mounted = false }
  }, [fetchLocationOptionsForProject, fetchDistrictOptionsForProject, fetchCentreOptionsForProject, JSON.stringify(form.projectLocations.map(pl => ({ project: pl.project, projectType: pl.projectType, district: pl.district })))] )

  const normalizeProjects = (resp) => {
    const payload = resp?.data ?? {};
    const rawList = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.projects)
        ? payload.projects
        : Array.isArray(payload?.results)
          ? payload.results
          : Array.isArray(payload)
            ? payload
            : [];

    return rawList
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'object') {
          const id = String(item.id ?? item.project_id ?? item.value ?? item.key ?? item._id ?? item.projectId ?? '');
          const name = String(item.name ?? item.project_name ?? item.title ?? item.label ?? item.value ?? id);
          return id ? { value: id, label: name } : null;
        }
        const v = String(item || '');
        return v ? { value: v, label: v } : null;
      })
      .filter(Boolean);
  }

  const fetchProjectOptionsForType = useCallback(async (projectType) => {
    try {
      const resp = await recruiterAPI.getProjectSuggestions('', 200, projectType)
      const normalized = normalizeProjects(resp)
      setProjectOptions(prev => ({ ...prev, [projectType]: normalized }))
    } catch (err) {
      setProjectOptions(prev => ({ ...prev, [projectType]: [] }))
    }
  }, [])

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [regularResp, writtenResp] = await Promise.all([
          recruiterAPI.getProjectSuggestions('', 200, 'regular'),
          recruiterAPI.getProjectSuggestions('', 200, 'written')
        ]);

        if (mounted) {
          setProjectOptions({
            regular: normalizeProjects(regularResp),
            written: normalizeProjects(writtenResp)
          });
        }
      } catch (err) {
        if (mounted) setProjectOptions({ regular: [], written: [] });
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.registrationId) {
      setError('Please select a registered candidate from the mobile suggestions before saving.')
      return
    }
    setLoading(true)
    try {
      const assignments = form.projectLocations
        .filter(pl => pl.project && ((pl.projectType === 'written' && pl.district && pl.centre) || (pl.projectType !== 'written' && pl.location)))
        .map(pl => {
          const base = {
            project: pl.project,
            project_type: pl.projectType,
            recipient_ids: (pl.allocatedRecipients || []).filter(Boolean)
          }
          if (pl.projectType === 'written') {
            base.district = pl.district
            base.centre = pl.centre
          } else {
            base.location = pl.location
          }
          return base
        })

      const payload = {
        registration_id: form.registrationId,
        name: form.name,
        phone: form.phone,
        email: form.email,
        project_locations: assignments,
        status: form.status,
        user_id: user?.userId
      }

      const identifier = initialData?.calling_team_login_id || initialData?.id;
      if (identifier) {
        // Ensure the identifier is used for the URL and included in the payload if needed
        await recruiterAPI.updateCaller(identifier, { ...payload, calling_team_login_id: identifier })
      } else {
        await recruiterAPI.createCaller(payload)
      } // Missing closing brace for the if/else block

      onSaved?.()
      onClose() // Global toast will handle success message
    } catch (err) {
      setError(err?.message || 'Failed to save caller')
    } finally {
      setLoading(false)
    }
  }

  const addProjectLocation = () => {
    setForm(prev => ({
      ...prev,
      projectLocations: [...prev.projectLocations, { ...DEFAULT_ASSIGNMENT }]
    }))
    setLocationOptions(prev => [...prev, []])
    setDistrictOptions(prev => [...prev, []])
    setCentreOptions(prev => [...prev, []])
  }

  const removeProjectLocation = (index) => {
    setForm(prev => ({
      ...prev,
      projectLocations: prev.projectLocations.filter((_, i) => i !== index)
    }))
    setLocationOptions(prev => prev.filter((_, i) => i !== index))
    setDistrictOptions(prev => prev.filter((_, i) => i !== index))
    setCentreOptions(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? 'Edit Caller' : 'Add Caller'} maxWidth="640px">
      <form onSubmit={handleSubmit}>
        {error && <div style={{ color: 'var(--red)', marginBottom: 8 }}>{error}</div>}
        <FormField label="Mobile">
          <div style={{ position: 'relative' }}>
            <input
              name="phone"
              className="form-control"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              required
              disabled={loading || callerDetailsLoading}
              autoComplete="off"
            />
            {showCandidateSuggestions && (
              <div ref={suggestionsRef} style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 2000,
                background: 'var(--card)',
                border: '1px solid rgba(0,0,0,0.12)',
                borderRadius: 6,
                marginTop: 4,
                maxHeight: 240,
                overflowY: 'auto',
                boxShadow: '0 12px 24px rgba(0,0,0,0.08)'
              }}>
                {candidateLoading ? (
                  <div style={{ padding: '10px', color: 'var(--text2)' }}>Looking up registered candidates…</div>
                ) : candidateSuggestions.length > 0 ? (
                  candidateSuggestions.map((candidate) => (
                    <button
                      key={`${candidate.registrationId}-${candidate.mobile}`}
                      type="button"
                      className="btn btn-link"
                      onClick={() => handleCandidateSelect(candidate)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text)',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{candidate.name || 'Registered candidate'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{candidate.mobile}{candidate.email ? ` • ${candidate.email}` : ''}</div>
                    </button>
                  ))
                ) : (
                  <div style={{ padding: '10px', color: 'var(--text2)' }}>No registered candidates found.</div>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: form.registrationId ? 'var(--green)' : 'var(--text2)', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              {form.registrationId
                ? `✓ Linked to registered candidate: ${form.name || 'User'}`
                : 'Type a registered mobile number and select from the list.'}
            </span>
            {form.registrationId && (
              <button 
                type="button" 
                className="btn btn-link btn-sm" 
                style={{ padding: 0, fontSize: '11px', textDecoration: 'underline' }}
                onClick={() => {
                  setForm(prev => ({ ...prev, registrationId: '', phone: '' }));
                  setShowCandidateSuggestions(false);
                }}
              >
                Change
              </button>
            )}
          </div>
        </FormField>

        <FormField label="Full Name">
          <input name="name" className="form-control" value={form.name} onChange={handleChange} required disabled={loading || callerDetailsLoading} />
        </FormField>

        <FormField label="Email">
          <input name="email" type="email" className="form-control" value={form.email} onChange={handleChange} disabled={loading || callerDetailsLoading} />
        </FormField>

        {callerDetailsLoading && <div style={{ textAlign: 'center', padding: '10px', color: '#666' }}>Loading caller details...</div>}

        <FormField label="Project Assignments">
          <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px' }}>
            {form.projectLocations.map((pl, index) => (
              <div key={index} style={{ marginBottom: index < form.projectLocations.length - 1 ? '16px' : '0', paddingBottom: index < form.projectLocations.length - 1 ? '16px' : '0', borderBottom: index < form.projectLocations.length - 1 ? '1px solid #eee' : 'none' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <strong>Assignment {index + 1}</strong>
                  {form.projectLocations.length > 1 && (
                    <button 
                      type="button" 
                      className="btn btn-danger btn-sm" 
                      onClick={() => removeProjectLocation(index)}
                      disabled={loading || callerDetailsLoading}
                      style={{ padding: '2px 6px', fontSize: '11px' }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Assignment Type</label>
                    <select
                      className="form-control"
                      value={pl.projectType || 'regular'}
                      onChange={async (e) => {
                        const nextType = e.target.value
                        updateProjectLocation(index, 'projectType', nextType)
                        updateProjectLocation(index, 'project', '')
                        updateProjectLocation(index, 'location', '')
                        updateProjectLocation(index, 'district', '')
                        updateProjectLocation(index, 'centre', '')
                        updateProjectLocation(index, 'recipientCount', 0)
                        updateProjectLocation(index, 'allocatedRecipients', [])
                        setLocationOptionsAt(index, [])
                        setDistrictOptionsAt(index, [])
                        setCentreOptionsAt(index, [])
                        await fetchProjectOptionsForType(nextType)
                        if (pl.project) {
                          if (nextType === 'written') {
                            await fetchDistrictOptionsForProject(pl.project, index)
                          } else {
                            await fetchLocationOptionsForProject(pl.project, index)
                          }
                        }
                      }}
                      style={{ fontSize: '14px' }}
                    >
                      <option value="regular">Regular project</option>
                      <option value="written">Written exam project</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Project</label>
                    <select 
                      className="form-control" 
                      value={pl.project} 
                      onChange={async (e) => {
                        const value = e.target.value
                        updateProjectLocation(index, 'project', value)
                        updateProjectLocation(index, 'location', '')
                        updateProjectLocation(index, 'district', '')
                        updateProjectLocation(index, 'centre', '')
                        updateProjectLocation(index, 'recipientCount', 0)
                        updateProjectLocation(index, 'allocatedRecipients', [])
                        setLocationOptionsAt(index, [])
                        setDistrictOptionsAt(index, [])
                        setCentreOptionsAt(index, [])
                        if (value) {
                          if (pl.projectType === 'written') {
                            await fetchDistrictOptionsForProject(value, index)
                          } else {
                            await fetchLocationOptionsForProject(value, index)
                          }
                        }
                      }}
                      style={{ fontSize: '14px' }}
                    >
                      <option value="">Select Project</option>
                      {(projectOptions[pl.projectType === 'written' ? 'written' : 'regular'] || []).map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {pl.projectType === 'written' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>District</label>
                      <select
                        className="form-control"
                        value={pl.district || ''}
                        onChange={async (e) => {
                          const value = e.target.value
                          updateProjectLocation(index, 'district', value)
                          updateProjectLocation(index, 'centre', '')
                          updateProjectLocation(index, 'recipientCount', 0)
                          updateProjectLocation(index, 'allocatedRecipients', [])
                          setCentreOptionsAt(index, [])
                          if (pl.project && value) {
                            await fetchCentreOptionsForProject(pl.project, value, index)
                          }
                        }}
                        disabled={!pl.project || loading || callerDetailsLoading}
                        style={{ fontSize: '14px' }}
                      >
                        <option value="">Select District</option>
                        {(districtOptions[index] || []).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Centre</label>
                      <select
                        className="form-control"
                        value={pl.centre || ''}
                        onChange={(e) => {
                          const value = e.target.value
                          updateProjectLocation(index, 'centre', value)
                          updateProjectLocation(index, 'recipientCount', 0)
                          updateProjectLocation(index, 'allocatedRecipients', [])
                          if (pl.project && pl.district && value) {
                            fetchRecipientCount(pl.projectType, pl.project, '', pl.district, value, index)
                          }
                        }}
                        disabled={!pl.project || !pl.district || loading || callerDetailsLoading}
                        style={{ fontSize: '14px' }}
                      >
                        <option value="">Select Centre</option>
                        {(centreOptions[index] || []).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', display: 'block' }}>Location</label>
                      <select 
                        className="form-control" 
                        value={pl.location} 
                        onChange={(e) => {
                          const newLocation = e.target.value
                          updateProjectLocation(index, 'location', newLocation)
                          updateProjectLocation(index, 'recipientCount', 0)
                          updateProjectLocation(index, 'allocatedRecipients', [])
                          if (pl.project && newLocation) {
                            fetchRecipientCount(pl.projectType, pl.project, newLocation, '', '', index)
                          }
                        }}
                        disabled={!pl.project || loading || callerDetailsLoading}
                        style={{ fontSize: '14px' }}
                      >
                        <option value="">Select Location</option>
                        {(locationOptions[index] || []).map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {(pl.project && ((pl.projectType === 'written' && pl.district && pl.centre) || (pl.projectType !== 'written' && pl.location))) && (
                  <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div>
                      Available Recipients: <strong>{pl.recipientCount}</strong> |
                      Allocated Recipients: <strong style={{ color: '#007bff' }}>{pl.allocatedRecipients.length}</strong>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary btn-sm" 
                      style={{padding: '2px 8px', fontSize: '11px', width: 'fit-content' }}
                      onClick={() => {
                        setAllocateData({
                          project: pl.project,
                          projectType: pl.projectType,
                          location: pl.location,
                          district: pl.district,
                          centre: pl.centre,
                          index,
                          initialSelected: pl.allocatedRecipients
                        })
                        setShowAllocateModal(true)
                      }}
                      disabled={loading || callerDetailsLoading || pl.recipientCount === 0}
                    >
                      Allocate Recipients
                    </button>
                  </div>
                )}
              </div>
            ))}
            
          </div>
        </FormField>
        <FormField label="Status">
          <select name="status" className="form-control" value={form.status} onChange={handleChange} disabled={loading || callerDetailsLoading}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FormField>

        <div style={{ position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb', background: 'var(--card, #fff)' }}>
          <button 
            type="button" 
            className="btn btn-outline btn-sm" 
            onClick={addProjectLocation}
            disabled={loading || callerDetailsLoading}
            style={{ padding: '4px 12px', fontSize: '12px' }}
          >
            + Add More Assignment
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || callerDetailsLoading || !form.registrationId}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </form>

      <AllocateRecipientsModal 
        isOpen={showAllocateModal} 
        onClose={() => setShowAllocateModal(false)} 
        project={allocateData?.project}
        projectType={allocateData?.projectType}
        location={allocateData?.location}
        district={allocateData?.district}
        centre={allocateData?.centre}
        callerId={allocateData?.callerId}
        initialSelected={allocateData?.initialSelected || []}
        onSelect={(recipientIds) => {
          updateProjectLocation(allocateData.index, 'allocatedRecipients', recipientIds)
          setShowAllocateModal(false)
        }}
      />
    </Modal>
  )
}
