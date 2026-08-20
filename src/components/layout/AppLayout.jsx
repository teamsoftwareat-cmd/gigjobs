import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useState } from 'react'

const PAGE_TITLES = {
  '/app/candidate/dashboard': ['Dashboard', 'Welcome back!'],
  '/app/candidate/profile': ['My Profile', 'Candidate Module'],
  '/app/candidate/jobs': ['Browse Jobs', 'Find your next gig in Chennai'],
  '/app/candidate/applications': ['My Applications', 'Candidate Module'],
  '/app/candidate/earnings': ['Earnings & Payouts', 'Candidate Module'],
  '/app/candidate/support': ['Support', 'Submit a help request'],
  '/app/candidate/verifier': ['Verifier Projects', 'View your verifier assignments'],
  '/app/recruiter/dashboard': ['Recruiter Dashboard', 'Operations Overview'],
  '/app/recruiter/attendance': ['Attendance Records', 'Recruiter Operations'],
  '/app/recruiter/applications': ['Applications', 'Recruiter Module'],
  '/app/recruiter/calling-team/recipients': ['Recipients Database', 'Manage call recipients'],
  '/app/recruiter/verification-team/list': ['Verification Team List', 'Manage your verification team'],
  '/app/recruiter/verification-team/recipients': ['Verification Team Database', 'Upload verification team roster'],
  '/app/recruiter/candidates': ['Candidate Database', 'Recruiter Module'],
  '/app/client/dashboard': ['Client Dashboard', 'Hexaware Technologies'],
  '/app/client/attendance': ['Attendance', 'Client Module'],
  '/app/accounts/dashboard': ['Payroll & Accounts', 'Finance Module'],
  '/app/accounts/invoices': ['Client Invoices', 'Accounts Module'],
  '/app/admin/dashboard': ['Admin Dashboard', 'Super Admin'],
  '/app/admin/settings': ['Platform Settings', 'Admin Module'],
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const [title, subtitle] = PAGE_TITLES[pathname] || (pathname.startsWith('/app/candidate/verifier')
    ? ['Verifier Projects', 'View your verifier assignments']
    : ['Dashboard', 'Cynosurejobs.net'])
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      return window.innerWidth >= 1200
    } catch (e) {
      return false
    }
  })

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="sidebar-overlay show" onClick={() => setSidebarOpen(false)} />}
      <div className="app-main">
        <Header title={title} subtitle={subtitle} onMenuClick={toggleSidebar} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}


