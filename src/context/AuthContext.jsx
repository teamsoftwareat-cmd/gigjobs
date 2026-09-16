import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, setAuthToken, clearAuthToken, setLogoutHandler, clearLogoutHandler } from '../api/axios'

const AuthContext = createContext(null)

/* ===== ROLE CONFIG ===== */
export const ROLES = {
  candidate: {
    role: 'candidate',
    label: 'Candidate',
    color: 'linear-gradient(135deg, #0E7C86, #6C3FC5)',
    roleTitle: 'Candidate Account',
    nav: [
      {
        section: 'My Space', items: [
          // { icon: 'tachometer-alt', label: 'Dashboard', page: '/app/candidate/dashboard' },
          { icon: 'user-circle', label: 'My Profile', page: '/app/candidate/profile' },
          // { icon: 'search', label: 'Browse Jobs', page: '/app/candidate/jobs' },
          // { icon: 'clipboard-list', label: 'My Applications', page: '/app/candidate/applications'},
          // { icon: 'rupee-sign', label: 'Earnings & Payouts', page: '/app/candidate/earnings' },
        ]
      },
      {
        section: 'More', items: [
          // { icon: 'clock', label: 'Attendance', page: '/app/candidate/attendance' },
          { icon: 'phone', label: 'Calling', page: '/app/candidate/calling' },
          { icon: 'user-check', label: 'Verifier', page: '/app/candidate/verifier' },
          { icon: 'file-invoice-dollar', label: 'Expenses', page: '/app/candidate/expenses' },
          // { icon: 'share-alt', label: 'Refer & Earn', page: '/app/candidate/dashboard' },
          { icon: 'headset', label: 'Support', page: '/app/candidate/support' },
        ]
      }
    ]
  },
  recruiter: {
    role: 'recruiter',
    label: 'Recruiter',
    color: 'linear-gradient(135deg, #F4A130, #E53935)',
    roleTitle: 'Recruiter / Operations',
    nav: [
      {
        section: 'Operations', items: [
          { icon: 'tachometer-alt', label: 'Dashboard', page: '/app/recruiter/dashboard' },
          { icon: 'project-diagram', label: 'Projects', page: '/app/recruiter/projects' },
          { icon: 'clock', label: 'Attendance', page: '/app/recruiter/attendance' },
          { icon: 'users', label: 'Candidate Database', page: '/app/recruiter/candidate-database' },
          { icon: 'file-invoice-dollar', label: 'Expenses', page: '/app/recruiter/expenses' },
          { icon: 'money-bill-wave', label: 'Payments', page: '/app/recruiter/payments' },
        ]
      },
      {
        section: 'Calling Team', items: [
          { icon: 'users', label: 'Calling Team List', page: '/app/recruiter/calling-team/list' },
          { icon: 'file-upload', label: 'Recipients Database', page: '/app/recruiter/calling-team/recipients' },
          { icon: 'users', label: 'Verification Team List', page: '/app/recruiter/verification-team/list' },
          { icon: 'file-upload', label: 'Verification Team Database', page: '/app/recruiter/verification-team/recipients' },
          { icon: 'clipboard-list', label: 'Verifier Checklists', page: '/app/recruiter/verification-team/checklists' },
          { icon: 'dashboard', label: 'Verifier Dashboard', page: '/app/recruiter/verification-team/dashboard' },
          // { icon: 'tasks', label: 'Candidate Status', page: '/app/recruiter/calling-team/status' },
        ]
      },
      // {
      //   section: 'Search', items: [
      //     { icon: 'search', label: 'Search Candidates', page: '/app/recruiter/search' },
      //     { icon: 'file-csv', label: 'Upload Candidate CSV', page: '/app/recruiter/upload-csv' },
      //   ]
      // },
      {
        section: 'Verification', items: [
          { icon: 'id-card', label: 'Aadhaar Valid', page: '/app/recruiter/validCandidate' },
          { icon: 'id-card', label: 'Aadhaar Invalid', page: '/app/recruiter/InvalidCandidate' },
          // { icon: 'qrcode', label: 'Registration / KYC', page: '/app/attendance/registration-kyc-status' },
          { icon: 'user-check', label: 'Check KYC', page: '/app/recruiter/check-kyc' },
          { icon: 'image-portrait', label: 'Face Matching', page: '/app/recruiter/face-matching' }
        ]
      },
      {
        section: 'More', items: [
          { icon: 'message', label: 'Campaigns', page: '/app/recruiter/campaigns' },
          { icon: 'certificate', label: 'Certifications', page: '/app/recruiter/certifications' },
          { icon: 'history', label: 'Document History', page: '/app/recruiter/document-history' },
          { icon: 'user', label: 'Applications', page: '/app/recruiter/applications' },
          { icon: 'headset', label: 'Support Tickets', page: '/app/recruiter/support-tickets' },
          { icon: 'check', label: 'Approve attendance', page: '/app/recruiter/approvals-tickets' }
        ]
      }
    ]
  },
  client: {
    role: 'client',
    label: 'Client',
    color: 'linear-gradient(135deg, #6C3FC5, #0E7C86)',
    roleTitle: 'Client',
    nav: [
      {
        section: 'My Portal', items: [
          { icon: 'dashboard', label: 'Verifier Dashboard', page: '/app/recruiter/verification-team/dashboard' },
          { icon: 'clipboard-list', label: 'Verifier Checklists', page: '/app/recruiter/verification-team/checklists' }
        ]
      }
    ]
  },
  accounts: {
    role: 'accounts',
    label: 'Accounts',
    color: 'linear-gradient(135deg, #1B9E5C, #0E7C86)',
    roleTitle: 'Accounts / Finance',
    nav: [
      {
        section: 'Operations', items: [
          { icon: 'tachometer-alt', label: 'Dashboard', page: '/app/recruiter/dashboard' },
          { icon: 'project-diagram', label: 'Projects', page: '/app/recruiter/projects' },
          { icon: 'clock', label: 'Attendance', page: '/app/recruiter/attendance' },
          { icon: 'users', label: 'Candidate Database', page: '/app/recruiter/candidate-database' },
          { icon: 'file-invoice-dollar', label: 'Expenses', page: '/app/recruiter/expenses' },
          { icon: 'money-bill-wave', label: 'Payments', page: '/app/recruiter/payments' },
        ]
      },
      {
        section: 'Calling Team', items: [
          { icon: 'users', label: 'Calling Team List', page: '/app/recruiter/calling-team/list' },
          { icon: 'file-upload', label: 'Recipients Database', page: '/app/recruiter/calling-team/recipients' },
          { icon: 'users', label: 'Verification Team List', page: '/app/recruiter/verification-team/list' },
          { icon: 'file-upload', label: 'Verification Team Database', page: '/app/recruiter/verification-team/recipients' },
          { icon: 'clipboard-list', label: 'Verifier Checklists', page: '/app/recruiter/verification-team/checklists' },
          { icon: 'dashboard', label: 'Verifier Dashboard', page: '/app/recruiter/verification-team/dashboard' },
          // { icon: 'tasks', label: 'Candidate Status', page: '/app/recruiter/calling-team/status' },
        ]
      },
      // {
      //   section: 'Search', items: [
      //     { icon: 'search', label: 'Search Candidates', page: '/app/recruiter/search' },
      //     { icon: 'file-csv', label: 'Upload Candidate CSV', page: '/app/recruiter/upload-csv' },
      //   ]
      // },
      {
        section: 'Verification', items: [
          { icon: 'id-card', label: 'Aadhaar Valid', page: '/app/recruiter/validCandidate' },
          { icon: 'id-card', label: 'Aadhaar Invalid', page: '/app/recruiter/InvalidCandidate' },
          // { icon: 'qrcode', label: 'Registration / KYC', page: '/app/attendance/registration-kyc-status' },
          { icon: 'user-check', label: 'Check KYC', page: '/app/recruiter/check-kyc' }
        ]
      },
      {
        section: 'More', items: [
          { icon: 'message', label: 'Campaigns', page: '/app/recruiter/campaigns' },
          { icon: 'user', label: 'Applications', page: '/app/recruiter/applications' },
          { icon: 'headset', label: 'Support Tickets', page: '/app/recruiter/support-tickets' },
          { icon: 'check', label: 'Approve attendance', page: '/app/recruiter/approvals-tickets' }
        ]
      }
    ]
  },
  admin: {
    role: 'admin',
    label: 'Admin',
    color: 'linear-gradient(135deg, #E53935, #6C3FC5)',
    roleTitle: 'Super Administrator',
    nav: [
      {
        section: 'Operations', items: [
          { icon: 'tachometer-alt', label: 'Dashboard', page: '/app/recruiter/dashboard' },
          { icon: 'project-diagram', label: 'Projects', page: '/app/recruiter/projects' },
          { icon: 'clock', label: 'Attendance', page: '/app/recruiter/attendance' },
          { icon: 'users', label: 'Candidate Database', page: '/app/recruiter/candidate-database' },
          { icon: 'file-invoice-dollar', label: 'Expenses', page: '/app/recruiter/expenses' },
          { icon: 'money-bill-wave', label: 'Payments', page: '/app/recruiter/payments' },
        ]
      },
      {
        section: 'Calling Team', items: [
          { icon: 'users', label: 'Calling Team List', page: '/app/recruiter/calling-team/list' },
          { icon: 'file-upload', label: 'Recipients Database', page: '/app/recruiter/calling-team/recipients' }
          // { icon: 'tasks', label: 'Candidate Status', page: '/app/recruiter/calling-team/status' },
        ]
      },
      // {
      //   section: 'Search', items: [
      //     { icon: 'search', label: 'Search Candidates', page: '/app/recruiter/search' },
      //     { icon: 'file-csv', label: 'Upload Candidate CSV', page: '/app/recruiter/upload-csv' },
      //   ]
      // },
      {
        section: 'Verification', items: [
          { icon: 'id-card', label: 'Aadhaar Valid', page: '/app/recruiter/validCandidate' },
          { icon: 'id-card', label: 'Aadhaar Invalid', page: '/app/recruiter/InvalidCandidate' },
          { icon: 'user-check', label: 'KYC', page: '/app/recruiter/verification/kyc' },
        ]
      },
      {
        section: 'More', items: [
          { icon: 'headset', label: 'Support Tickets', page: '/app/recruiter/support-tickets' },
          { icon: 'headset', label: 'Approve attendance', page: '/app/recruiter/approvals-tickets' }
        ]
      }
    ]
  }
}

const buildUser = (account, extra = {}) => {
  const userBase = {
    id: `usr_${account.role}`,
    name: account.name,
    username: account.username,
    role: account.role,
    initials: account.initials,
    color: account.color,
    roleLabel: account.label,
    roleTitle: account.roleTitle,
    homeRoute: `/app/${account.role}/dashboard`,
    userId: extra.userId,
    ...extra,
  }

  // Handle dynamic navigation based on permissions like 'calling'
  if (userBase.role === 'candidate' && account.nav) {
    userBase.navigation = account.nav.map(section => ({
      ...section,
      items: section.items.filter(item => {
        if (item.label === 'Calling') {
          return Number(userBase.calling) === 1
        }
        if (item.label === 'Expenses') {
          return Number(userBase.expenses) === 1
        }
        if (item.label === 'Verifier') {
          return Number(userBase.verifier) === 1
        }
        return true
      })
    }))
  } else {
    userBase.navigation = account.nav
  }

  return userBase
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  const persistToken = (token) => {
    if (!token) return
    localStorage.setItem('access_token', token)
    setAuthToken(token)
  }

  const persistUser = (userPayload) => {
    if (!userPayload) return
    localStorage.setItem('auth_user', JSON.stringify(userPayload))
  }

  const clearPersistedAuth = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('auth_user')
    clearAuthToken()
  }

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('access_token')
      const savedUserJson = localStorage.getItem('auth_user')
      let restoredUser = null

      if (token && savedUserJson) {
        try {
          restoredUser = JSON.parse(savedUserJson)
          setAuthToken(token)
          setUser(restoredUser)
          setAuthChecked(true)
          return
        } catch {
          restoredUser = null
          clearPersistedAuth()
        }
      }

      if (token && !restoredUser) {
        try {
          setAuthToken(token)
          const response = await authAPI.me()
          const userData = response?.data?.user || response?.data

          if (userData) {
            const role = userData.role || 'candidate'
            const roleConfig = ROLES[role] || ROLES.candidate
            const name = userData.name || userData.username || 'User'
            const username = userData.username || userData.mobile || ''
            const initials = (userData.initials ||
              (name || '')
                .split(' ')
                .filter(Boolean)
                .map((part) => part[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)) ||
              ''

            const account = {
              ...roleConfig,
              username,
              name,
              role,
              initials,
              color: userData.color || roleConfig.color,
              roleTitle: userData.roleTitle || roleConfig.roleTitle,
            }

            const userPayload = buildUser(account, {
              token,
              homeRoute: userData.homeRoute || `/app/${role}/dashboard`,
              userId: userData?.user_id,
              registrationId: userData?.registration_id,
              calling: userData?.calling,
              expenses: userData?.expenses,
            })

            setUser(userPayload)
            persistUser(userPayload)
          }
        } catch (error) {
          clearPersistedAuth()
        }
      }

      setAuthChecked(true)
    }

    initializeAuth()
  }, [])

  const extractRoleFromRoute = (route) => {
    if (!route) return null
    const match = route.match(/^\/app\/([^/]+)\//)
    return match ? match[1] : null
  }

  const login = async ({ username, password, mode = 'candidate' }) => {
    setLoading(true)
    try {
      if (mode !== 'internal') {
        return { success: false, error: 'Candidates must use OTP login via loginWithOtp' }
      }
      let apiResponse = null
      const authFn = authAPI.loginInternal

      try {
        apiResponse = await authFn({ username, password })
      } catch (apiError) {
        apiResponse = apiError?.response ? apiError.response : null
      }

      const apiData = apiResponse?.data || {}
      if (!apiData.success) {
        const message = apiData?.message || 'Invalid username or password'
        return { success: false, error: message }
      }

      const authToken = apiData?.access_token || apiData?.token
      persistToken(authToken)

      const role = apiData?.role || (mode === 'candidate' ? 'candidate' : 'recruiter')
      const roleConfig = ROLES[role] || ROLES.candidate
      const initials = (username || '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
      const account = {
        ...roleConfig,
        username,
        name: username || roleConfig.label,
        role,
        initials,
      }
      const userPayload = buildUser(account, {
        token: authToken,
        userId: apiData?.user_id,
        homeRoute: apiData?.homeRoute || `/app/${role}/dashboard`,
        calling: apiData?.calling,
        expenses: apiData?.expenses,
      })

      setUser(userPayload)
      persistUser(userPayload)
      return { success: true, user: userPayload }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed'
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  const loginWithOtp = async ({ mobile, otp }) => {
    setLoading(true)
    try {
      const apiResponse = await authAPI.loginCandidateVerifyOTP(mobile, otp)
      const top = apiResponse?.data || {}
      const success = typeof top.success === 'boolean' ? top.success : true
      if (!success) {
        return { success: false, error: top.message || 'Invalid OTP' }
      }

      const responseData = top.data || top
      const authToken = top.access_token || top.token || responseData.access_token || responseData.token
      persistToken(authToken)

      const refreshToken = top.refresh_token || responseData.refresh_token
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }

      const userData = responseData?.user || top?.user || {}
      const role = userData.role || responseData?.role || 'candidate'
      const roleConfig = ROLES[role] || ROLES.candidate

      const name = userData.name || responseData?.name || `+91 ${mobile}`
      const username = userData.email || userData.username || responseData?.username || mobile

      const initials = (userData.initials ||
        (name || '')
          .split(' ')
          .filter(Boolean)
          .map((part) => part[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)) ||
        ''

      const account = { ...roleConfig, username, name, role, initials }
      const verifier = userData?.verifier ?? responseData?.verifier ?? top?.verifier

      const userPayload = buildUser(account, {
        token: authToken,
        userId: userData.id || responseData?.user_id,
        registrationId: responseData?.registration_id || top.registration_id,
        homeRoute: userData.homeRoute || responseData?.homeRoute || `/app/${role}/dashboard`,
        email: userData.email,
        mobile: userData.mobile || mobile,
        aadhaar: userData.aadhaar || responseData?.aadhaar || responseData?.user?.aadhaar,
        calling: userData.calling,
        expenses: userData.expenses,
        verifier,
      })

      setUser(userPayload)
      persistUser(userPayload)
      return { success: true, user: userPayload }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Login failed'
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  const register = async (data) => {
    setLoading(true)
    try {
      const apiResponse = await authAPI.register(data)
      const apiData = apiResponse?.data || {}

      if (!apiData.success) {
        return { success: false, error: apiData?.message || 'Registration failed' }
      }

      const role = apiData?.user?.role || extractRoleFromRoute(apiData?.homeRoute) || 'candidate'
      const roleConfig = ROLES[role] || ROLES.candidate
      const name = apiData?.user?.name || apiData?.name || data.name || roleConfig.label
      const initials = apiData?.user?.initials || (name || '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

      const userPayload = buildUser(
        {
          ...roleConfig,
          username: data.email || '',
          name,
          role,
          initials,
        },
        {
          token: apiData?.token,
          userId: apiData?.user_id,
          homeRoute: apiData?.homeRoute || `/app/${role}/dashboard`,
          calling: apiData?.calling,
          expenses: apiData?.expenses,
        }
      )

      setUser(userPayload)
      persistUser(userPayload)
      return { success: true, user: userPayload }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Registration failed'
      return { success: false, error: message }
    } finally {
      setLoading(false)
    }
  }

  // DEV-ONLY: Temporary helper to quickly sign in as a recruiter for local testing.
  // Remove this function before shipping to production.
  const loginAsRecruiterDev = (opts = {}) => {
    try {
      const token = `dev-token-${Date.now()}`
      persistToken(token)

      const roleConfig = ROLES.recruiter || ROLES.candidate
      const account = {
        ...roleConfig,
        username: opts.username || 'dev.recruiter',
        name: opts.name || 'Dev Recruiter',
        role: 'recruiter',
        initials: opts.initials || 'DR',
      }

      const userPayload = buildUser(account, {
        token,
        userId: opts.userId || 'dev_recruiter',
        homeRoute: '/app/recruiter/dashboard',
        calling: opts.calling ?? 1,
        expenses: opts.expenses ?? 1,
      })

      setUser(userPayload)
      persistUser(userPayload)

      return { success: true, user: userPayload }
    } catch (err) {
      return { success: false, error: err?.message || 'Dev login failed' }
    }
  }

  // DEV-ONLY: Temporary helper to quickly sign in as a candidate for local testing.
  // Remove this function before shipping to production.
  const loginAsCandidateDev = (opts = {}) => {
    try {
      const token = `dev-token-${Date.now()}`
      persistToken(token)

      const roleConfig = ROLES.candidate
      const account = {
        ...roleConfig,
        username: opts.username || 'dev.candidate',
        name: opts.name || 'Dev Candidate',
        role: 'candidate',
        initials: opts.initials || 'DC',
      }

      const userPayload = buildUser(account, {
        token,
        userId: opts.userId || 'dev_candidate',
        homeRoute: '/app/candidate/dashboard',
        calling: opts.calling ?? 1,
        expenses: opts.expenses ?? 0,
      })

      setUser(userPayload)
      persistUser(userPayload)

      return { success: true, user: userPayload }
    } catch (err) {
      return { success: false, error: err?.message || 'Dev login failed' }
    }
  }

  const logout = useCallback(() => {
    setUser(null)
    clearPersistedAuth()
  }, [])

  useEffect(() => {
    setLogoutHandler(logout)
    return () => {
      clearLogoutHandler()
    }
  }, [logout])

  return (
    <AuthContext.Provider value={{ user, authChecked, login, loginWithOtp, register, logout, loading, loginAsRecruiterDev, loginAsCandidateDev }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
