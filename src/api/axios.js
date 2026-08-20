const resolveUrl = (url, params) => {
  const targetUrl = new URL(url, window.location.origin)
  if (params && Object.keys(params).length) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        targetUrl.searchParams.append(key, String(value))
      }
    })
    if (targetUrl.search) {
      targetUrl.search = targetUrl.search.replace(/\+/g, '%20')
    }
  }
  return targetUrl.toString()
}

let authToken = null
let logoutHandler = null

export const setAuthToken = (token) => {
  authToken = token
}

export const clearAuthToken = () => {
  authToken = null
}

export const setLogoutHandler = (handler) => {
  logoutHandler = handler
}

export const clearLogoutHandler = () => {
  logoutHandler = null
}

const buildHeaders = (customHeaders = {}, body) => {
  const headers = new Headers()
  headers.set('Accept', 'application/json')

  const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const hasFormData = body instanceof FormData
  if (!hasFormData) {
    headers.set('Content-Type', 'application/json')
  }

  Object.entries(customHeaders || {}).forEach(([key, value]) => {
    if (!value) return
    const normalized = key.toLowerCase()
    if (normalized === 'content-type' && hasFormData) return
    headers.set(key, value)
  })

  return headers
}

const urlIncludesNgrok = (url) =>
  String(url).includes('ngrok-free.dev') || String(url).includes('.ngrok.io')

export const DESIGNATION_FALLBACK_OPTIONS = [
  'Operators',
  'Supervisors',
  'Videographers',
  'Centre Head',
  'HR',
  'Bib Distribution',
  'Bib Collection',
  'Registration Executive',
  'Long Jump',
  'High Jump',
  'Chip Tying',
  'Chip Collection',
  'Verification',
  'CCTV',
  'Networking',
  'PST Operators',
  'PST Head',
  'Leica Operators',
  'Timers',
  'Enumerator',
  'Supervisor',
  'Security Escort',
  'Scanning',
  'Quality Control',
]

const normalizeDesignationList = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : []

  return list.map((item) => {
    if (typeof item === 'string') return item.trim()
    return String(item?.name || item?.designation || '').trim()
  }).filter(Boolean)
}

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  let data = null

  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    data = await response.text()
  }

  return {
    data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  }
}

const findMessage = (obj, depth = 0) => {
  if (!obj || depth > 4) return null
  if (typeof obj === 'string') return obj
  if (typeof obj !== 'object') return null
  if (Object.prototype.hasOwnProperty.call(obj, 'message') && obj.message) return String(obj.message)
  if (Object.prototype.hasOwnProperty.call(obj, 'msg') && obj.msg) return String(obj.msg)
  // sometimes APIs nest payload under `data` or `response`
  const keysToTry = ['data', 'response', 'error', 'result']
  for (const k of keysToTry) {
    if (obj[k]) {
      const found = findMessage(obj[k], depth + 1)
      if (found) return found
    }
  }
  // fallback: search object values shallowly
  for (const v of Object.values(obj)) {
    if (typeof v === 'object') {
      const found = findMessage(v, depth + 1)
      if (found) return found
    }
  }
  return null
}

const createError = (message, response, originalError) => {
  const error = new Error(message)
  if (response) error.response = response
  if (originalError) error.originalError = originalError
  return error
}

const performFetch = async (url, options = {}) => {
  try {
    const response = await fetch(url, options)
    return response
  } catch (err) {
    throw createError(`${err.message || 'Network Error'} (${url})`, null, err)
  }
}

const request = async (method, url, { data, params, headers, silent = false } = {}) => {
  const resolvedUrl = resolveUrl(url, params)
  const body = data instanceof FormData ? data : data != null ? JSON.stringify(data) : undefined
  const finalHeaders = buildHeaders(headers, data)

  if (urlIncludesNgrok(resolvedUrl)) {
    finalHeaders.set('ngrok-skip-browser-warning', 'true')
  }

  const response = await performFetch(resolvedUrl, {
    method,
    headers: finalHeaders,
    body,
    cache: 'no-store',
  })

  const parsed = await parseResponse(response)
  // Extract API message from common locations (handles nested structures)
  const responseMessageOriginal = (function () {
    const found = findMessage(parsed.data)
    if (found) return String(found).trim()
    return (typeof parsed.data === 'string' ? String(parsed.data).trim() : '')
  })()
  const responseMessage = String(responseMessageOriginal || '').toLowerCase()

  // Check if backend reports failure in body (e.g. success: false) even if HTTP status is 200
  const isLogicalError = (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data))
    ? parsed.data.success === false
    : false

  // Dispatch a global event for mutating methods so the UI can show API messages centrally
  try {
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE']
    const isMutation = method && mutating.includes(String(method).toUpperCase())
    const isError = !response.ok
    const isFailure = isError || isLogicalError

    if (!silent) {
      // Showcase message for ALL failures, or successful mutations that return a message
      if (isFailure || (isMutation && responseMessageOriginal)) {
        const displayMsg = responseMessageOriginal || (isFailure ? 'Request failed' : '')
        if (displayMsg) {
          window.dispatchEvent(new CustomEvent('apiMessage', {
            detail: {
              type: isFailure ? 'error' : 'success',
              message: displayMsg,
              status: parsed.status,
            },
          }))
        }
      }
    }
  } catch (e) {
    // ignore any dispatch errors (e.g. non-browser environments)
  }

  const isTokenExpired = responseMessage === 'token has expired'
  const isUnauthenticated = responseMessage === 'unauthenticated.'

  if (isTokenExpired || isUnauthenticated) {
    if (typeof logoutHandler === 'function') {
      logoutHandler()
    }
    const errorMsg = isTokenExpired ? 'Token has expired' : 'Unauthenticated'
    throw createError(errorMsg, parsed)
  }

  if (isLogicalError) {
    throw createError(responseMessageOriginal || 'Operation failed', parsed)
  }

  if (!response.ok) {
    // Include the requested URL in the error for better diagnostics
    throw createError(`Request to ${resolvedUrl} failed with status ${response.status}`, parsed)
  }

  return parsed
}

const api = {
  get: (url, config = {}) => request('GET', url, config),
  post: (url, data, config = {}) => request('POST', url, { data, params: config.params, headers: config.headers }),
  put: (url, data, config = {}) => request('PUT', url, { data, params: config.params, headers: config.headers }),
  patch: (url, data, config = {}) => request('PATCH', url, { data, params: config.params, headers: config.headers }),
  delete: (url, config = {}) => request('DELETE', url, config),
}

// Use only VITE_API_BASE_URL and VITE_MOCK_API_URL per request
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''
const MOCK_API_BASE = import.meta.env.VITE_MOCK_API_URL || ''

const normalizeBase = (u) => String(u || '').replace(/\/+$/g, '')

const BASE = normalizeBase(API_BASE)
const MOCK_BASE = normalizeBase(MOCK_API_BASE)

const normalizeVerificationTeamPayload = (data = {}) => {
  const payload = { ...(data || {}) }
  const phone = String(payload.phone || payload.mobile || '').trim()
  const normalizedAssignments = Array.isArray(payload.project_locations)
    ? payload.project_locations
        .filter(Boolean)
        .map((item) => {
          const assignment = {}
          const titleId = String(item?.title_id || item?.titleId || item?.title || item?.project || item?.project_id || item?.projectId || '').trim()
          const venue = String(item?.venue || '').trim()

          if (titleId) assignment.title_id = titleId
          if (venue) assignment.venue = venue

          const countValue = item?.recipientCount ?? item?.recipient_count ?? item?.count
          if (countValue !== undefined && countValue !== null && countValue !== '') {
            const parsedCount = Number(countValue)
            if (Number.isFinite(parsedCount)) assignment.count = parsedCount
          }

          return assignment
        })
        .filter((item) => item.title_id || item.venue)
    : []

  const normalizedPayload = {
    ...payload,
    name: String(payload.name || '').trim(),
    phone,
    mobile: phone,
    email: String(payload.email || '').trim() || undefined,
    status: payload.status || 'active',
    project_locations: normalizedAssignments,
  }

  if (payload.registration_id || payload.registrationId) {
    normalizedPayload.registration_id = String(payload.registration_id || payload.registrationId || '').trim()
  }

  return normalizedPayload
}

export default api

/* ===== AUTH ===== */
export const authAPI = {
  login: (data) => api.post(`${BASE}/login`, data),
  loginCandidateSendOTP: (mobile) => api.post(`${BASE}/candidate/send-otp`, { mobile }),
  loginCandidateVerifyOTP: (mobile, otp) => api.post(`${BASE}/jobseeker/verify-otp-login`, { mobile, otp }),
  loginInternal: (data) => api.post(`${BASE}/login`, data),
  completeRegistration: (data) => api.post(`${BASE}/candidate-registration`, data),
  sendMobileOTP: (mobile) => api.post(`${BASE}/send-otp`, { mobile }),
  verifyMobileOTP: (mobile, otp) => api.post(`${BASE}/verify-otp`, { mobile, otp }),
  checkMobileExists: (mobile) => api.get(`${BASE}/check-mobile-exists/${mobile}/`),
  createInternalUser: (data) => api.post(`${BASE}/register`, data),
  logout: () => api.post(`${BASE}/logout`),
  me: () => api.get(`${BASE}/auth/me`),
  verifyFace: (file) => {
    // Logging size for analysis
    if (file instanceof Blob) {
      console.log(`[verifyFace] Uploading image: ${(file.size / 1024).toFixed(2)} KB`);
    }

    const formData = new FormData()

    // Ensure a filename is provided, especially for Blobs captured via camera.
    // This is safer for mobile browsers that might have issues with the File constructor.
    if (file instanceof Blob && !(file instanceof File)) {
      formData.append('image', file, 'face_capture.jpg')
    } else {
      formData.append('image', file)
    }

    const FACE_API = import.meta.env.VITE_FACE_API_URL || 'https://facial.careersinchennai.in/capture-face'

    return api.post(
      FACE_API,
      formData,
      {
        headers: {
          'x-api-key': '123456'
        }
      }
    )
  },
  sendEmailOTP: (email) => api.post(`${BASE}/send-email-otp`, { email }),
  verifyEmailOTP: (email, otp) => api.post(`${BASE}/verify-email-otp`, { email, otp }),
  sendInternalForgotPasswordOTP: (mobile) => api.post(`${BASE}/internal/forgot-password/send-otp`, { mobile }),
  verifyInternalForgotPasswordOTP: (mobile, otp) => api.post(`${BASE}/internal/forgot-password/verify-otp`, { mobile, otp }),
  resetInternalForgotPassword: ({ mobile, otp, password }) => api.post(`${BASE}/internal/forgot-password/reset`, { mobile, otp, password }),
}

/* ===== CANDIDATE ===== */
export const candidateAPI = {
  /* ===== DASHBOARD (MODULAR) ===== */
  getStats: () => api.get(`${MOCK_BASE}/candidate/dashboard/kpis`),

  // Candidate dashboard attendance summary used on the candidate dashboard
  getAttendance: (params = {}) => api.get(`${MOCK_BASE}/candidate/dashboard/attendance`, { params }),

  // Candidate attendance project/location groups for the candidate
  getAttendanceProjectLocations: (registrationId, params = {}) => api.get(`${BASE}/candidate/dashboard/attendance-project-locations`, {
    params: {
      ...params,
      registration_id: registrationId,
    },
  }),

  // Candidate attendance records for a specific project-location
  getAttendanceRecords: (registrationId, projectId, locationId, params = {}) => {
    const requestParams = {
      ...params,
      registration_id: registrationId,
      project_id: projectId,
    }
    if (locationId) {
      requestParams.location_id = locationId
    }
    return api.get(`${BASE}/candidate/dashboard/attendancefull`, {
      params: requestParams,
    })
  },

  getRecentApplications: () => api.get(`${MOCK_BASE}/candidate/dashboard/recent-applications`, { params: { limit: 5 } }),

  getEarningsChart: () => api.get(`${MOCK_BASE}/candidate/dashboard/earnings`),

  /* ===== PROFILE ===== */
  getProfile: (registrationId) => api.get(`${BASE}/candidate/profile`, {
    params: registrationId ? { registration_id: registrationId } : {}
  }),
  updateProfile: (registrationId, data) => api.post(`${BASE}/candidate/profile/update`, data, {
    params: registrationId ? { registration_id: registrationId } : {}
  }),
  checkAadhaarVerification: (params = {}) => api.get(`${BASE}/candidate/aadhaar-verification`, { params }),

  uploadResume: (id, file) => {
    const form = new FormData()
    form.append('resume', file)
    return api.post(`${BASE}/candidates/${id}/resume`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadAadhaarFront: (id, file) => {
    const form = new FormData()
    form.append('aadhaarFront', file)
    return api.post(`${BASE}/candidates/${id}/aadhaar/front`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadAadhaarBack: (id, file) => {
    const form = new FormData()
    form.append('aadhaarBack', file)
    return api.post(`${BASE}/candidates/${id}/aadhaar/back`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /* ===== OTHER ===== */
  getApplications: (registrationId, params = {}) =>
    api.get(`${BASE}/candidates/${registrationId}/applications`, { params }),

  getSupportTickets: (registrationId, params = {}) => api.get(`${BASE}/candidate/support-requests`, {
    params: {
      registration_id: registrationId,
      ...params,
    },
  }),

  getSupportTicketDetails: (ticketId, registrationId) => api.get(`${BASE}/candidate/support-tickets/ticketId/${ticketId}`, {
    params: registrationId ? { registration_id: registrationId } : {},
  }),

  getEarnings: (id, params = {}) => api.get(`${BASE}/candidates/${id}/earnings`, { params }),

  clockIn: (id, data) => api.post(`${BASE}/candidates/${id}/clock-in`, data),
  clockOut: (id, data) => api.post(`${BASE}/candidates/${id}/clock-out`, data),
  markAttendance: (data) => api.post(`${BASE}/attendance/mark`, data),
  markGroupPhoto: (data) => api.post(`${BASE}/job_seeker/attendance/group-photo`, data),
  submitExpense: (registrationId, data) => api.post(`${BASE}/candidate/expense/store`, data, {
    params: registrationId ? { registration_id: registrationId } : {},
  }),

  getExpenseHistory: (registrationId, params = {}) => api.get(`${BASE}/candidate/expenses`, {
    params: { ...params, registration_id: registrationId },
  }),

  submitPoliceInfo: (data) => api.post(`${BASE}/candidate/police-info`, data),

  /* ===== CALLING ===== */
  // Get list of project-locations that the candidate is assigned to
  getAssignedProjectLocations: (registrationId, params = {}) => api.get(`${BASE}/candidates/calling/projects-locations`, { params: { ...params, registration_id: registrationId } }),
  // Get list of project-locations that the candidate can submit expenses for
  getAssignedProjectLocationsExpenses: (registrationId, params = {}) => api.get(`${BASE}/candidates/expenses/projects-locations`, { params: { ...params, registration_id: registrationId } }),
  // Get recipients for a specific project-location
  getRecipientsForProjectLocation: (registrationId, projectId, locationId, params = {}) => api.get(`${BASE}/candidates/calling/recipients`, { params: { ...params, registration_id: registrationId, project: projectId, location: locationId } }),
  // Get all recipients for a specific centre (with pagination/search)
  getCentreRecipients: (registrationId, projectId, params = {}) => api.get(`${BASE}/candidates/calling/centre-recipients`, { params: { ...params, registration_id: registrationId, project: projectId } }),
  // Get all centre statistics for a district
  getCentreCallerStats: (registrationId, projectId, districtId) => api.get(`${BASE}/candidates/calling/centre-stats`, { params: { registration_id: registrationId, project: projectId, district: districtId } }),
  // Make a call to a recipient
  makeCall: (registrationId, recipientId, data) => api.post(`${BASE}/candidates/calls/${recipientId}`, { ...data, registration_id: registrationId }),
  // Update recipient/call status
  updateRecipientStatus: (registrationId, recipientId, data) => api.post(`${BASE}/candidates/recipients/${recipientId}/status`, { ...data, registration_id: registrationId }),
  // Update recipient contact details
  updateRecipientContact: (registrationId, recipientId, data) => api.post(`${BASE}/candidates/recipients/${recipientId}/contact`, { ...data, registration_id: registrationId }),
  // Shift recipients to a new centre
  shiftRecipients: (data) => api.post(`${BASE}/candidates/calling/shift-recipients`, data),
  // Add a referral candidate
  addReferralCandidate: (data) => api.post(`${BASE}/candidates/calling/add-referral`, data),

  /* ===== VERIFIER ===== */
  getVerifierProjects: (registrationId, params = {}) => api.get(`${BASE}/candidate/verifier/projects`, { params: { ...params, registration_id: registrationId } }),
  getVerifierProjectVenues: (registrationId, titleId, params = {}) => api.get(`${BASE}/candidate/verifier/projects/venues`, { params: { ...params, registration_id: registrationId, title_id: titleId } }),
  // Get centres for a given title/venue (used by verifier UI centre selector)
  getVerifierCenters: (titleId, venue, params = {}) => api.get(`${BASE}/candidate/verifier/centres`, { params: { ...params, title_id: titleId, venue } }),
  // getVerifierProjectLocations: (registrationId, projectId, params = {}) => api.get(`${MOCK_BASE}/candidate/verifier/projects/${projectId}/locations`, { params: { ...params, registration_id: registrationId } }),
  // getVerifierProjectDistricts: (registrationId, projectId, params = {}) => api.get(`${MOCK_BASE}/candidate/verifier/projects/${projectId}/districts`, { params: { ...params, registration_id: registrationId } }),
  getVerifierRecipients: (registrationId, projectId, locationId, params = {}) => api.get(`${BASE}/candidate/verifier/recipientsabcde`, { params: { ...params, registration_id: registrationId, project: projectId, location: locationId } }),
  getVerifierChecklist: (titleId, venue, centreKey, params = {}) => api.get(`${BASE}/candidate/verifier/checklist`, {
    params: {
      ...params,
      title_id: titleId,
      venue,
      centre_id: centreKey,
      centre_code: centreKey,
    },
  }),
  saveVerifierChecklist: (titleId, venue, centreKey, data) => api.post(`${BASE}/candidate/verifier/checklist`, {
    ...data,
    title_id: titleId,
    venue,
    centre_id: centreKey,
    centre_code: centreKey,
  }),
  getVerifierSchoolAttendance: (titleId, venue, params = {}) => api.get(`${BASE}/candidate/verifier/school-attendance-get`, {
    params: {
      ...params,
      title_id: titleId,
      venue,
    },
  }),
  saveVerifierSchoolAttendance: (titleId, venue, data) => api.post(`${BASE}/candidate/verifier/school-attendance`, {
    ...data,
    title_id: titleId,
    venue,
  }),
  postVerifierIssueStatus: (titleId, venue, data) => api.post(`${BASE}/candidate/verifier/issue-status`, {
    ...data,
    title_id: titleId,
    venue,
  }),
  makeVerifierCall: (registrationId, recipientId, data) => api.post(`${BASE}/candidate/verifier/calls/${recipientId}`, { ...data, registration_id: registrationId }),
  updateVerifierRecipientStatus: (registrationId, recipientId, data = {}, context = {}) => {
    const payload = {
      ...(data || {}),
      registration_id: registrationId,
      ...(context.titleId !== undefined && context.titleId !== null ? { title_id: context.titleId } : {}),
      ...(context.title_id !== undefined && context.title_id !== null ? { title_id: context.title_id } : {}),
      ...(context.venue !== undefined && context.venue !== null ? { venue: context.venue } : {}),
      ...(context.centreId ? { centre_id: context.centreId, centre_code: context.centreId } : {}),
      ...(context.centreCode ? { centre_id: context.centreCode, centre_code: context.centreCode } : {}),
      ...(context.recipientId !== undefined && context.recipientId !== null ? { recipient_id: context.recipientId } : {}),
      ...(context.name ? { name: context.name } : {}),
      ...(context.mobile ? { mobile: context.mobile } : {}),
      ...(context.aadhaar ? { aadhaar: context.aadhaar } : {}),
      ...(context.designation ? { designation: context.designation } : {}),
      ...(context.day ? { day: context.day } : {}),
      ...(context.projectDay ? { project_day: context.projectDay } : {}),
      ...(context.notes !== undefined && context.notes !== null ? { notes: context.notes } : {}),
    }

    const params = {
      registration_id: registrationId,
      ...(context.titleId !== undefined && context.titleId !== null ? { title_id: context.titleId } : {}),
      ...(context.title_id !== undefined && context.title_id !== null ? { title_id: context.title_id } : {}),
      ...(context.venue !== undefined && context.venue !== null ? { venue: context.venue } : {}),
      ...(context.centreId ? { centre_id: context.centreId, centre_code: context.centreId } : {}),
      ...(context.centreCode ? { centre_id: context.centreCode, centre_code: context.centreCode } : {}),
    }

    return api.post(`${BASE}/candidate/verifier/recipients/${recipientId}/status`, payload, { params })
  },
  replaceVerifierRecipient: (registrationId, recipientId, data = {}, titleId, venue, centreKey) => {
    const replaceParams = {
      registration_id: registrationId,
      ...(titleId !== undefined && titleId !== null ? { title_id: titleId } : {}),
      ...(venue !== undefined && venue !== null ? { venue } : {}),
      ...(centreKey ? { centre_id: centreKey, centre_code: centreKey } : {}),
    }

    return api.post(`${BASE}/candidate/verifier/recipients/${recipientId}/replace`, { ...data, registration_id: registrationId }, { params: replaceParams })
  },

  /* ===== KYC VERIFICATION ===== */
  getKYCInfo: (params = {}) => api.get(`${BASE}/employee/kyc-info`, { params }),

  /* ===== JOBS ===== */
  getJobs: (params = {}) => api.get(`${BASE}/jobs`, { params }),
  getJobFilters: () => api.get(`${BASE}/candidate-filters`),
  applyJob: (registrationId, jobId, data) => {
    const url = `${BASE}/candidate/jobs/apply`
    const formData = data instanceof FormData ? data : new FormData()

    if (!(data instanceof FormData)) {
      Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return
        if (Array.isArray(value)) {
          value.forEach((item) => formData.append(`${key}[]`, item))
        } else {
          formData.append(key, value)
        }
      })
    }

    if (!formData.has('registration_id')) {
      formData.append('registration_id', registrationId)
    }
    if (!formData.has('jobId') && jobId !== undefined && jobId !== null) {
      formData.append('jobId', jobId)
    }

    return api.post(url, formData)
  },
}

export const recruiterAPI = {
  faceSearchAPI: (formData) => api.post('https://cynosurejobs.net/digilocker/face-indentification/upload1.php', formData),
  getDashboardKpis: (params = {}) => api.get(`${BASE}/dashboard-stats`, { params }),
  getAadharOverview: () => api.get(`${MOCK_BASE}/recruiter/dashboard/aadhar-overview`),
  getOcrTrend: () => api.get(`${MOCK_BASE}/recruiter/dashboard/ocr-trend`),
  getProjects: (params = {}) => api.get(`${BASE}/projects-list`, { params }),
  getProjectsSupport: (params = {}) => api.get(`${BASE}/projects-list-support`, { params }),
  getProjectsWithPaymentData: (params = {}) => api.get(`${MOCK_BASE}/projects-with-payment-data`, { params }),
  // Alias for fetching project-level payment summaries / KPIs (used by Payments UI)
  getProjectsPaymentKPIs: (params = {}) => api.get(`${MOCK_BASE}/payment-data-kpis`, { params }),
  getPaymentReportsforRazor: (params = {}) => api.get(`${MOCK_BASE}/payment-reports-razor`, { params }),
  /* ===== attendance TEAM ===== */
  // params: { search, from, to, offset, limit }
  getAttendanceRecords: (params = {}) => api.get(`${BASE}/attendance-report`, { params }),
  getWrittenExamAttendanceRecords: (params = {}) => api.get(`${BASE}/attendance-report/written-exam`, { params }),
  getPaymentReports: (params = {}) => api.get(`${BASE}/attendancepaymentsheet`, { params }),
  getWrittenExamPaymentReports: (params = {}) => api.get(`${BASE}/attendancepaymentsheet/written-exam`, { params }),
  // Server-side payments listing for recruiter UI (supports search/filters/pagination)
  getPaymentsList: (params = {}) => api.get(`${BASE}/employee/payments-list`, { params }),
  getPaymentSummary: (params = {}) => api.get(`${MOCK_BASE}/attendance-payment-summary`, { params }),
  getWrittenExamPaymentSummary: (params = {}) => api.get(`${MOCK_BASE}/attendance-payment-summary/written-exam`, { params }),
  processExternalPaymentSheet: (formData) => api.post(`${BASE}/employee/payments/external-sheet`, formData),
  getProjectRates: (projectId) => api.get(`${MOCK_BASE}/projects/${projectId}/rates`),
  saveProjectRates: (projectId, data) => api.post(`${MOCK_BASE}/projects/${projectId}/rates`, data),
  requestAttendanceChange: (data) => api.post(`${BASE}/attendance/change-request`, data),
  getAttendanceChangeRequests: (params = {}) => api.get(`${BASE}/employee/attendance/change-requests`, { params }),
  updateAttendanceChangeRequest: (requestId, data) => api.post(`${MOCK_BASE}/attendance/change-request/${requestId}`, data),
  bulkUpdateAttendanceChangeRequests: (data) => api.post(`${BASE}/employee/attendance/change-requests/bulk`, data),
  getAttendanceStats: () => api.get(`${BASE}/employee/attendance/stats`),
  updateCandidateRole: (data) => api.post(`${BASE}/candidate-role-update`, data),
  uploadManualAttendance: (data) => api.post(`${BASE}/attendance/manual-upload`, data),
  searchAttendanceByCsv: (formData, params = {}) => api.post(`${BASE}/attendance/search-csv`, formData, { params }),
  searchCandidateAadhaarByCsv: (formData, params = {}) => api.post(`${BASE}/attendance/candidate-aadhaar-search`, formData, { params }),
  savePaymentConfiguration: (projectId, data) => api.post(`${MOCK_BASE}/projects/${projectId}/payment-config`, data),
  getPaymentConfiguration: (projectId) => api.get(`${MOCK_BASE}/projects/${projectId}/payment-config`),
  getMandateRecords: (params = {}) => api.get(`${BASE}/project-summary`, { params }),
  getWrittenExamMandateRecords: (params = {}) => api.get(`${BASE}/project-summary-written`, { params }),
  getProjectSuggestions: (query = '', limit = 1000, projectType) => api.get(`${BASE}/project-suggestions`, { params: { q: query, limit, projectType } }),
  getDesignations: (projectId) => api.get(`${BASE}/designations`, { params: { projectId } })
    .then((response) => {
      const normalized = normalizeDesignationList(response?.data ?? {})
      return {
        ...response,
        data: normalized.length > 0 ? normalized : DESIGNATION_FALLBACK_OPTIONS,
      }
    })
    .catch((error) => {
      console.warn('Designation API failed, using fallback values', error)
      return {
        data: DESIGNATION_FALLBACK_OPTIONS,
        status: error?.response?.status || 500,
        statusText: error?.response?.statusText || 'Fallback',
        headers: error?.response?.headers || new Headers(),
      }
    }),
  getProjectMainLocation: () => api.get(`${BASE}/project-main-locations`),
  getClients: (params = {}) => api.get(`${BASE}/clients`, { params }),
  getProjectLocations: (project) => api.get(`${BASE}/project-location-suggestions`, { params: { project } }),
  getLocationCentres: (project, location) => api.get(`${BASE}/location-centre-suggestions`, { params: { project, location } }),
  getProjectDistricts: (project) => api.get(`${BASE}/project-district-suggestions`, { params: { project } }),
  getDistrictCentres: (project, district) => api.get(`${BASE}/district-centre-suggestions`, { params: { project, district } }),
  // New endpoints for project stats (frontend expects backend routes as below)
  // params: { from, to, designation, search, limit, offset }
  getProjectStats: (projectId, params = {}) => api.get(`${BASE}/employee/projects/${projectId}/stats`, { params: { ...params } }),
  // Get stats for a specific district (returns centre-wise counts for written exams)
  getProjectDistrictStats: (projectId, districtId, params = {}) => api.get(`${BASE}/employee/projects/${projectId}/districts/${districtId}/districtcentrewise`, { params: { ...params } }),
  createProject: (data) => api.post(`${BASE}/recruiter/projects`, data),
  createRegularProject: (data) => api.post(`${BASE}/create-regular-projects`, data),
  createWrittenExamProject: (data) => api.post(`${BASE}/create-regular-projects`, data),
  getProject: (projectId) => api.get(`${BASE}/editProject/${projectId}`),
  checkAttendanceLinkStatus: (projectId) => api.get(`${BASE}/candidate/attendance/link-status`, { params: { projectId } }),
  setProjectAttendanceStatus: (projectId, status) => api.post(`${BASE}/employee/projects/${projectId}/attendance-status`, { status }),
  updateProject: (projectId, data) => api.post(`${BASE}/projects/${projectId}/update`, data),
  getWrittenExamData: (projectId, config = {}) => api.get(`${BASE}/projects/${projectId}/written-exam-data`, config),
  updateWrittenExamData: (projectId, data) => api.post(`${BASE}/projects/${projectId}/written-exam-data`, data),
  saveWrittenExamRow: (projectId, rowData) => api.post(`${BASE}/projects/${projectId}/written-exam-row`, rowData),
  deleteWrittenExamRow: (projectId, rowId) => api.post(`${BASE}/projects/${projectId}/delete-written-exam-row`, { id: rowId }),
  updateProjectStatus: (projectId, status) => api.post(`${BASE}/projects/${projectId}`, { status }),
  getCandidates: (params = {}) => api.get(`${BASE}/candidates-registered`, { params }),
  getApplications: (params = {}) => api.get(`${BASE}/employee/applications`, { params }),
  updateApplicationStatus: (applicationId, data = {}) => api.post(`${BASE}/employee/applications/${applicationId}/status`, data),
  // Mock endpoint for project members (use MOCK_BASE)
  rejectAttendance: (attendanceId, data) => api.post(`${BASE}/attendance/${attendanceId}/reject`, data),
  acceptAttendance: (attendanceId, data = {}) => api.post(`${BASE}/attendance/${attendanceId}/accept`, data),
  getFraudAttendanceRecords: (params = {}) => api.get(`${BASE}/attendance-report/fraud`, { params }),
  acceptFraudAttendance: (attendanceId, data = {}) => api.post(`${BASE}/attendance/${attendanceId}/accept-fraud`, data),
  getProjectCandidates: (params = {}) => api.get(`${BASE}/project-candidates`, { params }),
  addReferralCandidate: (data) => api.post(`${BASE}/employee/calling/add-referral`, data),

  /* ===== EXPENSES ===== */
  getExpensesReport: (params = {}) => api.get(`${BASE}/employee/expenses-report`, { params }),
  getExpenseDetails: (expenseId) => api.get(`${BASE}/employee/expenses/${expenseId}`),
  updateExpenseStatus: (expenseId, data) => api.post(`${BASE}/employee/expenses/${expenseId}/status`, data),
  grantExpenseAccess: (data) => api.post(`${BASE}/employee/expense-access`, data),
  revokeExpenseAccess: (data) => api.post(`${BASE}/employee/expense-deactivateExpenseAccess-list`, data),
  getCandidatesWithExpenseAccess: (params = {}) => api.get(`${BASE}/employee/expense-access-list`, { params }),

  /* ===== CALLING TEAM ===== */
  // params: { search, from, to, offset, limit }
  getCallers: (params = {}) => api.get(`${MOCK_BASE}/calling_team_list`, { params }),
  getAssignedCallers: (params = {}) => api.get(`${BASE}/callers/assigned`, { params }),
  getUnassignedCallers: (params = {}) => api.get(`${BASE}/unassigned`, { params }),
  getCallerById: (calling_team_login_id) => api.get(`${BASE}/caller/edit/callerId/${calling_team_login_id}`),
  getCallerKpis: () => api.get(`${MOCK_BASE}/call_kpis`),
  createCaller: (data) => api.post(`${BASE}/add-caller`, data),
  updateCaller: (calling_team_login_id, data) => api.post(`${BASE}/caller/edit/${calling_team_login_id}`, data),
  bulkCreateCallers: (formData) => api.post(`${BASE}/callers/bulk`, formData),
  getCallerCalls: (callerId, params = {}) => api.get(`${BASE}/employee/individual_call_details/callerId=${callerId}`, { params }),
  updateCallStatus: (callId, data) => api.post(`${MOCK_BASE}/update_call_status/callerId=${callId}`, data),
  getRecipientCount: (params = {}) => api.get(`${BASE}/recipients-count`, { params }),
  getRecipients: (params = {}) => api.get(`${BASE}/allocate-recipients`, { params }),
  searchRecipients: (params = {}) => api.get(`${BASE}/employee/recipients/search`, { params }),
  searchRecipientsByFile: (formData) => api.post(`${BASE}/employee/recipients/search-upload`, formData),
  allocateRecipients: (data) => api.post(`${MOCK_BASE}/allocate-recipients`, data),
  // Expected query params: { search, from, to, offset, limit }
  // Expected response shape for modal table: { data: { items: [...], total: number, offset: number, limit: number } }
  getOutsideCandidates: (params = {}) => api.get(`${BASE}/outside-attendance`, { params }),
  getCandidateById: (id, config = {}) => api.get(`${BASE}/candidates/${id}`, config),
  postCandidateId: (id, data = {}) => api.post(`${BASE}/recruiter/candidates/${id}/post-id`, { candidate_id: id, ...data }),
  getAadhaarOcrVerification: (id, config = {}) => api.get(`${BASE}/employee/${id}/aadhaar-ocr-verification`, config),
  getInvalidAadhaarData: (id, config = {}) => api.get(`${BASE}/employee/${id}/aadhaar-invalid-data`, config),
  addCandidate: (data) => api.post(`${BASE}/recruiter/candidates/addnew`, data),
  // Alias for bulk upload / recipients import — keeps intent explicit
  uploadRecipients: (formData) => api.post(`${BASE}/candidates/import`, formData),
  uploadVerificationTeamDatabase: (formData) => api.post(`${BASE}/recruiter/verification-team/database`, formData),
  getVerificationTeamDatabaseRecords: (params = {}) => api.get(`${BASE}/recruiter/verification-team/database-list`, { params }),
  getVerificationTeamDatabaseRecordsWithTimer: (params = {}) => api.get(`${BASE}/recruiter/verification-team/database-list-with-timer`, { params }),
  getVerificationTeamDatabaseVenueRecords: (titleId, params = {}) => api.get(`${BASE}/recruiter/verification-team/database-list/venues`, {
    params: { ...params, id: titleId },
  }),
  updateVerificationTeamDatabaseRecord: (recordId, data) => api.post(`${BASE}/recruiter/verification-team/database-edit/${recordId}`, data),
  getVerificationTeamMembers: (params = {}) => api.get(`${BASE}/recruiter/verification-team/members`, { params }),
  createVerificationTeamMember: async (data) => {
    const payload = normalizeVerificationTeamPayload(data)
    const response = await api.post(`${BASE}/recruiter/verification-team/members-create`, payload)
    return response?.data ?? response
  },
  updateVerificationTeamMember: async (memberId, data) => {
    const payload = normalizeVerificationTeamPayload(data)
    const response = await api.post(`${BASE}/recruiter/verification-team/members-edit/${memberId}`, payload)
    return response?.data ?? response
  },
  // Returns counts of verification recipients (by query params such as project, district, location)
  getVerificationRecipientsCount: (params = {}) => api.get(`${BASE}/recruiter/verification-team/recipients/count`, { params }),
  assignCandidate: (data) => api.post(`${BASE}/assign-project`, data),
  reassignRecipient: (data) => api.post(`${BASE}/employee/recipients/reassign`, data),
  getPortalFieldMappings: (portalId) => api.get(`${BASE}/portal/mapping`, { params: { portal_id: portalId } }),
  uploadPaymentRecords: (data) => api.post(`${MOCK_BASE}/payments/upload-records`, data),
  checkRegistrationStatus: (formData) => api.post(`${BASE}/employee/check-registration-status`, formData),
  checkKYCStatus: (formData) => api.post(`${BASE}/employee/check-kyc-status`, formData),
  getCampaignHistory: (params = {}) => api.get(`${BASE}/employee/registration-campaign-history`, { params }),
  // Notify a list of candidates (expects multipart/form-data with an Excel/CSV file)
  // Accepts optional query params: project_id, portal (sms|whatsapp|email), message_type
  notifyCampaign: (formData, params = {}) => api.post(`${BASE}/employee/notify-sms`, formData, { params }),

  /* ===== RECIPIENTS DATABASE DASHBOARD ===== */
  getTotalCandidates: (params = {}) => api.get(`https://Cynosurejobs.net/gig_jobs/employee/upload_csv_files/total_candidates.php`, { params }),
  getActivePortals: (params = {}) => api.get(`https://Cynosurejobs.net/gig_jobs/employee/upload_csv_files/active_portals.php`, { params }),
  getUploadsCount: (params = {}) => api.get(`https://Cynosurejobs.net/gig_jobs/employee/upload_csv_files/fetch_total_can_wise.php`, { params }),
  getPortalDistribution: (params = {}) => api.get(`https://Cynosurejobs.net/gig_jobs/employee/upload_csv_files/portal-distribution.php`, { params }),
  getImportStatistics: (params = {}) => api.get(`https://Cynosurejobs.net/gig_jobs/employee/upload_csv_files/import-stats.php`, { params }),

  /* ===== SUPPORT TICKETS ===== */
  getSupportTickets: (params = {}) => api.get(`${BASE}/support-requests`, { params }),
  getTicketDetails: (ticketId) => api.get(`${BASE}/support-tickets/ticketId/${ticketId}`),
  getSupportTicketStats: (params = {}) => api.get(`${BASE}/stats`, { params }),  
  getSupportTicketKPIs: (params = {}) => api.get(`${BASE}/support/status-summary`, { params }),
  getIndividualSupportHistory: (candidateId, params = {}) => api.get(`${BASE}/support-history/candidate/${candidateId}`, { params }),
  updateTicketStatus: (ticketId, data) => api.post(`${BASE}/support-tickets/${ticketId}`, data),
  addTicketReply: (ticketId, data) => api.post(`${MOCK_BASE}/support-tickets/${ticketId}/reply`, data),
  sendEmailMessage: (data) => api.post(`${MOCK_BASE}/send-email`, data),
  sendWhatsAppMessage: (data) => api.post(`${MOCK_BASE}/send-whatsapp`, data),
  getWhatsAppTemplates: () => api.get(`${MOCK_BASE}/whatsapp-templates`),
  getWhatsAppTemplateDetails: (id) => api.get(`${MOCK_BASE}/whatsapp-templates-details/id=${id}`),
  submitTicket: (data) => api.post(`${MOCK_BASE}/support-tickets`, data),

  /* ===== AADHAAR UPLOADS (EMPLOYEE) ===== */
  uploadAadhaarFront: (id, file) => {
    const form = new FormData()
    form.append('aadhaarFront', file)
    return api.post(`${BASE}/employee/${id}/aadhaar/front`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadAadhaarBack: (id, file) => {
    const form = new FormData()
    form.append('aadhaarBack', file)
    return api.post(`${BASE}/employee/${id}/aadhaar/back`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /* ===== VALID CANDIDATES ===== */
  getValidCandidates: (params = {}) =>
    api.get(`${BASE}/employee/validCandidate`, { params }),
  getInvalidCandidate: (params = {}) =>
    api.get(`${BASE}/employee/InvalidCandidate`, { params }),
  getRegistrationKycStatus: (params = {}) =>
    api.get(`${BASE}/employee/registration-kyc-status`, { params }),
}

// Mark payments as paid (bulk)
recruiterAPI.markPaymentsPaid = (paymentIds = [], data = {}) => {
  // Expecting backend route: POST /payments/mark-paid with { paymentIds: [...] }
  return api.post(`${BASE}/employee/payments/mark-paid`, { paymentIds, ...data })
}

// Expose candidate-calling helper wrappers on recruiterAPI so recruiter UI components
// can call calling-related endpoints through recruiterAPI (keeps intent explicit)
recruiterAPI.getAssignedProjectLocations = (registrationId, params = {}) => api.get(`${BASE}/employee/calling/projects-locations`, { params: { ...params, registration_id: registrationId } })
recruiterAPI.getRecipientsForProjectLocation = (registrationId, projectId, locationId, params = {}) => api.get(`${BASE}/employee/calling/recipients`, { params: { ...params, registration_id: registrationId, project: projectId, location: locationId } })
recruiterAPI.getCentreRecipients = (registrationId, projectId, params = {}) => api.get(`${BASE}/employee/calling/centre-recipients`, { params: { ...params, registration_id: registrationId, project: projectId } })
recruiterAPI.getCentreCallerStats = (registrationId, projectId, districtId) => api.get(`${BASE}/employee/calling/centre-stats`, { params: { registration_id: registrationId, project: projectId, district: districtId } })
recruiterAPI.makeCall = (registrationId, recipientId, data) => api.post(`${BASE}/employee/calls/${recipientId}`, { ...data, registration_id: registrationId })
recruiterAPI.updateRecipientStatus = (registrationId, recipientId, data) => api.post(`${BASE}/employee/recipients/${recipientId}/status`, { ...data, registration_id: registrationId })
recruiterAPI.updateRecipientContact = (registrationId, recipientId, data) => api.post(`${BASE}/employee/recipients/${recipientId}/contact`, { ...data, registration_id: registrationId })
recruiterAPI.shiftRecipients = (data) => api.post(`${BASE}/employee/calling/shift-recipients`, data)

/* ===== VERIFIER ENDPOINTS ===== */
// Recruiter-specific verifier endpoints for viewing verifier assignments
recruiterAPI.getVerifierProjects = (registrationId, params = {}) => api.get(`${BASE}/recruiter/verifier/projects`, { params: { ...params, registration_id: registrationId } })
recruiterAPI.getVerifierProjectVenues = (registrationId, titleId, params = {}) => api.get(`${BASE}/recruiter/verifier/projects/venues`, { params: { ...params, registration_id: registrationId, title_id: titleId } })
recruiterAPI.getVerifierCenters = (titleId, venue, params = {}) => api.get(`${BASE}/recruiter/verifier/centres`, { params: { ...params, title_id: titleId, venue } })
recruiterAPI.getVerificationDashboardSummary = async (titleId, venue, centreKey, params = {}) => {
  const normalizedParams = {
    ...params,
    ...(titleId !== undefined && titleId !== null && titleId !== '' ? { title_id: titleId } : {}),
    ...(venue !== undefined && venue !== null && venue !== '' ? { venue } : {}),
    ...(centreKey && centreKey !== 'ALL' ? { centre_id: centreKey, centre_code: centreKey } : {}),
  }

  return api.get(`${BASE}/recruiter/verifier/summary`, { params: normalizedParams })
}
recruiterAPI.getVerificationDashboardItems = async (status, titleId, venue, centreKey, params = {}) => {
  const normalizedParams = {
    ...params,
    ...(status ? { status } : {}),
    ...(titleId !== undefined && titleId !== null && titleId !== '' ? { title_id: titleId } : {}),
    ...(venue !== undefined && venue !== null && venue !== '' ? { venue } : {}),
    ...(centreKey && centreKey !== 'ALL' ? { centre_id: centreKey, centre_code: centreKey } : {}),
  }

  return api.get(`${BASE}/recruiter/verifier/records`, { params: normalizedParams })
}
recruiterAPI.getVerifierRecipients = (registrationId, projectId, locationId, params = {}) => api.get(`${BASE}/recruiter/verifier/recipientsabcde`, { params: { ...params, registration_id: registrationId, project: projectId, location: locationId } })
recruiterAPI.getVerifierChecklist = (titleId, venue, centreKey, params = {}) => api.get(`${BASE}/recruiter/verifier/checklist`, {
  params: {
    ...params,
    title_id: titleId,
    venue,
    centre_id: centreKey,
    centre_code: centreKey,
  },
})
recruiterAPI.saveVerifierChecklist = (titleId, venue, centreKey, data) => api.post(`${BASE}/recruiter/verifier/checklist`, {
  ...data,
  title_id: titleId,
  venue,
  centre_id: centreKey,
  centre_code: centreKey,
})
recruiterAPI.getVerifierSchoolAttendance = (titleId, venue, params = {}) => api.get(`${BASE}/recruiter/verifier/school-attendance`, {
  params: {
    ...params,
    title_id: titleId,
    venue,
  },
})
recruiterAPI.saveVerifierSchoolAttendance = (titleId, venue, data) => api.post(`${BASE}/recruiter/verifier/school-attendance`, {
  ...data,
  title_id: titleId,
  venue,
})
recruiterAPI.postVerifierIssueStatus = (titleId, venue, data) => api.post(`${BASE}/recruiter/verifier/issue-status`, {
  ...data,
  title_id: titleId,
  venue,
})
recruiterAPI.makeVerifierCall = (registrationId, recipientId, data) => api.post(`${BASE}/recruiter/verifier/calls/${recipientId}`, { ...data, registration_id: registrationId })
recruiterAPI.updateVerifierRecipientStatus = (registrationId, recipientId, data = {}, context = {}) => {
  const payload = {
    ...(data || {}),
    registration_id: registrationId,
    ...(context.titleId !== undefined && context.titleId !== null ? { title_id: context.titleId } : {}),
    ...(context.title_id !== undefined && context.title_id !== null ? { title_id: context.title_id } : {}),
    ...(context.venue !== undefined && context.venue !== null ? { venue: context.venue } : {}),
    ...(context.centreId ? { centre_id: context.centreId, centre_code: context.centreId } : {}),
    ...(context.centreCode ? { centre_id: context.centreCode, centre_code: context.centreCode } : {}),
    ...(context.recipientId !== undefined && context.recipientId !== null ? { recipient_id: context.recipientId } : {}),
    ...(context.name ? { name: context.name } : {}),
    ...(context.mobile ? { mobile: context.mobile } : {}),
    ...(context.aadhaar ? { aadhaar: context.aadhaar } : {}),
    ...(context.designation ? { designation: context.designation } : {}),
    ...(context.day ? { day: context.day } : {}),
    ...(context.projectDay ? { project_day: context.projectDay } : {}),
    ...(context.notes !== undefined && context.notes !== null ? { notes: context.notes } : {}),
  }

  const params = {
    registration_id: registrationId,
    ...(context.titleId !== undefined && context.titleId !== null ? { title_id: context.titleId } : {}),
    ...(context.title_id !== undefined && context.title_id !== null ? { title_id: context.title_id } : {}),
    ...(context.venue !== undefined && context.venue !== null ? { venue: context.venue } : {}),
    ...(context.centreId ? { centre_id: context.centreId, centre_code: context.centreId } : {}),
    ...(context.centreCode ? { centre_id: context.centreCode, centre_code: context.centreCode } : {}),
  }

  return api.post(`${BASE}/recruiter/verifier/recipients/${recipientId}/status`, payload, { params })
}
recruiterAPI.replaceVerifierRecipient = (registrationId, recipientId, data = {}, titleId, venue, centreKey) => {
  const replaceParams = {
    registration_id: registrationId,
    ...(titleId !== undefined && titleId !== null ? { title_id: titleId } : {}),
    ...(venue !== undefined && venue !== null ? { venue } : {}),
    ...(centreKey ? { centre_id: centreKey, centre_code: centreKey } : {}),
  }

  return api.post(`${BASE}/recruiter/verifier/recipients/${recipientId}/replace`, { ...data, registration_id: registrationId }, { params: replaceParams })
}

// OTP endpoints specific to recruiter flows (avoid using authAPI)
recruiterAPI.sendMobileOTPforverifiers = (mobile) => api.post(`${BASE}/candidate/send-otp`, { mobile })
recruiterAPI.verifyMobileOTPforverifiers = (mobile, otp) => api.post(`${BASE}/jobseeker/verify-otp-login`, { mobile, otp })

export const publicAPI = {
  submitTicket: (data) => api.post(`${BASE}/support-request`, data),
}

export const masterDataAPI = {
  getAreas: () => api.get(`${MOCK_BASE}/Areas`),
  getLanguages: () => api.get(`${MOCK_BASE}/Languages`),
  getSkills: () => api.get(`${MOCK_BASE}/skills`),
  getTravelDistances: () => api.get(`${MOCK_BASE}/travel`),
  getJobTypes: () => api.get(`${MOCK_BASE}/jobtype`),
  getEducationLevels: () => api.get(`${MOCK_BASE}/education`),
  getShifts: () => api.get(`${MOCK_BASE}/shifts`),
  getGenders: () => api.get(`${MOCK_BASE}/Gender`),
  getColleges: () => api.get(`${MOCK_BASE}/College`),
  getDegrees: () => api.get(`${MOCK_BASE}/Degree`),
  validateReferral: (code) => api.get(`${MOCK_BASE}/referral/${code}/`),
}
