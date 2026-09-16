import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { AlertProvider } from './context/AlertContext'

import Landing from './pages/Landing'
import InternalLanding from './pages/InternalLanding'
import AppLayout from './components/layout/AppLayout'
import RegistrationPage from './components/Registration/RegistrationPage'
import GlobalToastProvider from './components/Common/GlobalToastProvider'
import Toast from './components/Common/Toast'
import MaintenanceGate from './components/Common/MaintenanceGate'
import SupportRequestModal from './components/SupportRequestModal'

/* Candidate */
import CandidateDashboard from './pages/candidate/Dashboard'
import CandidateProfile from './pages/candidate/Profile'
import CandidateJobs from './pages/candidate/Jobs'
import CandidateExpenses from './pages/candidate/Expenses'
import CandidateAttendance from './pages/attendance/Attendance'
import KYCverify from './pages/attendance/KYCverify'
import AadhaarUpload from './pages/attendance/AadhaarUpload'
import PoliceInfo from './pages/attendance/PoliceInfo'
import CandidateAttendanceSummary from './pages/candidate/AttendanceSummary'
import CandidateAttendanceDetails from './pages/candidate/Attendance'
import CandidateCallingProjects from './pages/candidate/CallingProjects'
import CandidateCallingRecipients from './pages/candidate/CallingRecipients'
import VerifierProjects from './pages/candidate/VerifierProjects'
import VerifierProjectDetails from './pages/candidate/VerifierProjectDetails'
import VerifierRecipients from './pages/candidate/VerifierRecipients'
import { CandidateApplications } from './pages/candidate/Applications'
import { CandidateEarnings } from './pages/candidate/Earnings'
import CandidateSupportPage from './pages/candidate/Support'

/* Recruiter */
import CandidateDatabase from './pages/recruiter/CandidateDatabase'
import CandidateInfo from './pages/recruiter/CandidateInfo'
import RecruiterAttendanceSummary from './pages/recruiter/AttendanceSummary'
import RecruiterAttendanceDetails from './pages/recruiter/AttendanceData'
import RecruiterPaymentSheet from './pages/recruiter/PaymentSheet'
import { RecruiterDashboard, RecruiterCandidates } from './pages/recruiter/index'
import { SupportTickets } from './pages/recruiter/SupportTickets'
import RecruiterProjects from './pages/recruiter/Projects'
import ProjectStats from './pages/recruiter/ProjectStats'
import Campaigns from './pages/recruiter/Campaigns'
import CallingTeam from './pages/recruiter/CallingTeam'
import RecipientsDatabase from './pages/recruiter/RecipientsDatabase'
import VerificationTeamList from './pages/recruiter/VerificationTeamList'
import VerificationTeamDatabase from './pages/recruiter/VerificationTeamDatabase'
import VerifierChecklistPage from './pages/recruiter/VerifierChecklistPage'
import VerificationDashboardPage from './pages/recruiter/VerificationDashboard'
import ValidCandidate from './pages/recruiter/validCandidate'
import InvalidCandidate from './pages/recruiter/invalidCandidate'
import RegistrationKycStatus from './pages/attendance/RegistrationKycStatus'
import Expenses from './pages/recruiter/Expenses'
import CheckKYC from './pages/recruiter/CheckKYC'
import DocumentExportHistory from './pages/recruiter/DocumentExportHistory'
import RecruiterAttendanceApprovals from './pages/recruiter/AttendanceApprovals'
import RecruiterApplications from './pages/recruiter/Applications'
import FaceMatching from './pages/recruiter/FaceSearch'
import Certifications from './pages/recruiter/Certifications'

/* Client */
import { ClientDashboard, ClientAttendance } from './pages/client/index'

/* Accounts */
import { AccountsDashboard, AccountsInvoices } from './pages/accounts/index'

/* Admin */
import { AdminDashboard, AdminSettings } from './pages/admin/index'

/* Recruiter Payments */
import RecruiterPayments from './pages/recruiter/Payments'
import NotFound from './pages/NotFound'

/* ===== Protected Route ===== */
function ProtectedRoute({ children }) {
  const { user, authChecked } = useAuth()
  const location = useLocation()

  if (!authChecked) {
    return null
  }

  if (!user) {
    const isCandidatePage = location.pathname.startsWith('/app/candidate')
    return <Navigate to={isCandidatePage ? "/" : "/internal"} replace />
  }

  return children
}

function AppRoutes({ showToast }) {
  const { authChecked } = useAuth()

  if (!authChecked) {
    return null
  }

  return (
    <Routes>
      {/* Landing */}
      <Route path="/" element={<MaintenanceGate enabled={false}><Landing /></MaintenanceGate>} />
      <Route path="/internal" element={<MaintenanceGate enabled={false}><InternalLanding /></MaintenanceGate>} />
      <Route path="/register" element={<MaintenanceGate enabled={false}><RegistrationPage showToast={showToast} /></MaintenanceGate>} />
      <Route path="/attendance" element={<MaintenanceGate enabled={false}><CandidateAttendance /></MaintenanceGate>} />
      <Route path="/attendance/kycverify" element={<MaintenanceGate enabled={false}><KYCverify /></MaintenanceGate>} />
      <Route path="/attendance/aadhaar-upload" element={<MaintenanceGate enabled={false}><AadhaarUpload /></MaintenanceGate>} />
      <Route path="/attendance/police-info" element={<MaintenanceGate enabled={false}><PoliceInfo /></MaintenanceGate>} />
      <Route path="/attendance/registration-kyc-status" element={<MaintenanceGate enabled={false}><RegistrationKycStatus /></MaintenanceGate>} />
      <Route path="/support-request" element={<SupportRequestModal variant="page" onClose={() => window.history.back()} />} />

      {/* App Shell — all dashboard routes */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>

        {/* Candidate */}
        <Route path="candidate/dashboard" element={<MaintenanceGate enabled={false}><CandidateDashboard /></MaintenanceGate>} />
        <Route path="candidate/profile" element={<MaintenanceGate enabled={false}><CandidateProfile /></MaintenanceGate>} />
        <Route path="candidate/jobs" element={<MaintenanceGate enabled={false}><CandidateJobs /></MaintenanceGate>} />
        <Route path="candidate/expenses" element={<MaintenanceGate enabled={false}><CandidateExpenses /></MaintenanceGate>} />
        <Route path="candidate/applications" element={<MaintenanceGate enabled={false}><CandidateApplications /></MaintenanceGate>} />
        <Route path="candidate/earnings" element={<MaintenanceGate enabled={false}><CandidateEarnings /></MaintenanceGate>} />
        <Route path="candidate/attendance" element={<MaintenanceGate enabled={false}><CandidateAttendanceSummary /></MaintenanceGate>} />
        <Route path="candidate/attendance/details" element={<MaintenanceGate enabled={false}><CandidateAttendanceDetails /></MaintenanceGate>} />
        <Route path="candidate/calling" element={<MaintenanceGate enabled={false}><CandidateCallingProjects /></MaintenanceGate>} />
        <Route path="candidate/calling/recipients" element={<MaintenanceGate enabled={false}><CandidateCallingRecipients /></MaintenanceGate>} />
        <Route path="candidate/verifier" element={<MaintenanceGate enabled={false}><VerifierProjects /></MaintenanceGate>} />
        <Route path="candidate/verifier/projects/:projectId" element={<MaintenanceGate enabled={false}><VerifierProjectDetails /></MaintenanceGate>} />
        {/* Removed VerifierProjectCentres page; navigate directly to recipients for written projects */}
        <Route path="candidate/verifier/recipients/:venueId" element={<MaintenanceGate enabled={false}><VerifierRecipients /></MaintenanceGate>} />
        <Route path="candidate/support" element={<MaintenanceGate enabled={false}><CandidateSupportPage /></MaintenanceGate>} />

        {/* Recruiter */}
        <Route path="recruiter/dashboard" element={<MaintenanceGate enabled={false}><RecruiterDashboard /></MaintenanceGate>} />
        <Route path="recruiter/attendance" element={<MaintenanceGate enabled={false}><RecruiterAttendanceSummary /></MaintenanceGate>} />
        <Route path="recruiter/attendance/details" element={<MaintenanceGate enabled={false}><RecruiterAttendanceDetails /></MaintenanceGate>} />
        <Route path="recruiter/attendance/payment" element={<MaintenanceGate enabled={false}><RecruiterPaymentSheet /></MaintenanceGate>} />
        <Route path="recruiter/projects" element={<MaintenanceGate enabled={false}><RecruiterProjects /></MaintenanceGate>} />
        <Route path="recruiter/campaigns" element={<MaintenanceGate enabled={false}><Campaigns /></MaintenanceGate>} />
        <Route path="recruiter/project-stats" element={<MaintenanceGate enabled={false}><ProjectStats /></MaintenanceGate>} />
        <Route path="recruiter/calling-team/list" element={<MaintenanceGate enabled={false}><CallingTeam /></MaintenanceGate>} />
        <Route path="recruiter/calling-team/recipients" element={<MaintenanceGate enabled={false}><RecipientsDatabase /></MaintenanceGate>} />
        <Route path="recruiter/verification-team/list" element={<MaintenanceGate enabled={false}><VerificationTeamList /></MaintenanceGate>} />
        <Route path="recruiter/verification-team/recipients" element={<MaintenanceGate enabled={false}><VerificationTeamDatabase /></MaintenanceGate>} />
        <Route path="recruiter/verification-team/checklists" element={<MaintenanceGate enabled={false}><VerifierChecklistPage /></MaintenanceGate>} />
        <Route path="recruiter/verification-team/dashboard" element={<MaintenanceGate enabled={false}><VerificationDashboardPage /></MaintenanceGate>} />
        <Route path="recruiter/candidate-database" element={<MaintenanceGate enabled={false}><CandidateDatabase /></MaintenanceGate>} />
        <Route path="recruiter/candidate/:candidateId" element={<MaintenanceGate enabled={false}><CandidateInfo /></MaintenanceGate>} />
        <Route path="recruiter/candidates" element={<MaintenanceGate enabled={false}><RecruiterCandidates /></MaintenanceGate>} />
        <Route path="recruiter/support-tickets" element={<MaintenanceGate enabled={false}><SupportTickets /></MaintenanceGate>} />
        <Route path="recruiter/approvals-tickets" element={<MaintenanceGate enabled={false}><RecruiterAttendanceApprovals /></MaintenanceGate>} />
        <Route path="recruiter/validCandidate" element={<MaintenanceGate enabled={false}><ValidCandidate /></MaintenanceGate>} />
        <Route path="recruiter/InvalidCandidate" element={<MaintenanceGate enabled={false}><InvalidCandidate /></MaintenanceGate>} />
        <Route path="recruiter/check-kyc" element={<MaintenanceGate enabled={false}><CheckKYC /></MaintenanceGate>} />
        <Route path="recruiter/document-history" element={<MaintenanceGate enabled={false}><DocumentExportHistory /></MaintenanceGate>} />
        <Route path="recruiter/expenses" element={<MaintenanceGate enabled={false}><Expenses /></MaintenanceGate>} />
        <Route path="recruiter/applications" element={<MaintenanceGate enabled={false}><RecruiterApplications /></MaintenanceGate>} />
        <Route path="recruiter/certifications" element={<MaintenanceGate enabled={false}><Certifications /></MaintenanceGate>} />
        <Route path="recruiter/face-matching" element={<MaintenanceGate enabled={false}><FaceMatching /></MaintenanceGate>} />

        {/* Client */}
        <Route path="client/dashboard" element={<MaintenanceGate enabled={false}><ClientDashboard /></MaintenanceGate>} />
        <Route path="client/attendance" element={<MaintenanceGate enabled={false}><ClientAttendance /></MaintenanceGate>} />

        {/* Accounts */}
        <Route path="accounts/dashboard" element={<MaintenanceGate enabled={false}><AccountsDashboard /></MaintenanceGate>} />
        <Route path="accounts/invoices" element={<MaintenanceGate enabled={false}><AccountsInvoices /></MaintenanceGate>} />

        {/* Admin */}
        <Route path="admin/dashboard" element={<MaintenanceGate enabled={false}><AdminDashboard /></MaintenanceGate>} />
        <Route path="admin/settings" element={<MaintenanceGate enabled={false}><AdminSettings /></MaintenanceGate>} />

        {/* Recruiter Payments */}
        <Route path="recruiter/payments" element={<MaintenanceGate enabled={false}><RecruiterPayments /></MaintenanceGate>} />

        {/* Default redirect */}
        <Route index element={<Navigate to="candidate/dashboard" replace />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  const showToast = (icon, message) => {
    // Dispatch event to GlobalToastProvider instead of using local state
    window.dispatchEvent(new CustomEvent('apiMessage', {
      detail: { icon, message, type: icon === '❌' ? 'error' : 'success' }
    }))
  }


  return (
    <ThemeProvider>
      <AuthProvider>
        <AlertProvider>
            <HashRouter>
              <AppRoutes showToast={showToast} />
            </HashRouter>
        </AlertProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
