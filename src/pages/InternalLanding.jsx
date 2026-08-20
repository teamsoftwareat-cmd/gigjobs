import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBuilding, faChartLine, faUsers, faClipboardCheck } from '@fortawesome/free-solid-svg-icons'
import InternalLoginModal from './auth/InternalLoginModal'
import './Landing.css'

export default function InternalLanding() {
  const [showLogin, setShowLogin] = useState(false)
  const navigate = useNavigate()

  return (
    <div id="landing" className="internal-landing">
      <nav className="land-nav">
        <div className="nav-left">
          <div className="logo-box">CY</div>
          <div>
            <div className="logo-title">Cynosurejobs.net</div>
            <div className="logo-sub">Internal Operations Portal</div>
          </div>
        </div>

        <div className="land-nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#insights">Insights</a>
          <a href="#teams">Teams</a>
          <a href="#contact">Support</a>
        </div>

        <button className="btn-login" style={{display: 'none'}} onClick={() => navigate('/')}>Candidate Site</button>
      </nav>

      <section className="land-hero">
        <div className="land-tag">
          <FontAwesomeIcon icon={faBuilding} /> Internal team access
        </div>

        <h1 className="land-h1">
          Recruiter and admin <span>operations</span> in one place.
        </h1>

        <p className="land-sub">
          Track candidate pipelines, approvals and compliance with a secure internal
          workspace built for recruiters, accounts, and operations teams.
        </p>

        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={() => setShowLogin(true)}>
            Internal Sign In
          </button>
        </div>

        <div className="land-stats">
          <div>
            <strong>200+</strong>
            <span>Recruiters</span>
          </div>
          <div>
            <strong>50+</strong>
            <span>Clients</span>
          </div>
          <div>
            <strong>16K</strong>
            <span>Profiles Managed</span>
          </div>
          <div>
            <strong>98%</strong>
            <span>Compliance</span>
          </div>
        </div>
      </section>

      <section className="landing-features" id="workflow">
        <div className="feature-card">
          <FontAwesomeIcon icon={faChartLine} />
          <h3>Pipeline visibility</h3>
          <p>See candidate status, job slot progress, and approvals at a glance.</p>
        </div>
        <div className="feature-card">
          <FontAwesomeIcon icon={faUsers} />
          <h3>Team coordination</h3>
          <p>Shared views for recruiters, accounts, and compliance teams keep workflows aligned.</p>
        </div>
        <div className="feature-card">
          <FontAwesomeIcon icon={faClipboardCheck} />
          <h3>Compliance first</h3>
          <p>Automated checks for payroll, attendance, and documentation reduce manual follow-up.</p>
        </div>
      </section>

      {showLogin && <InternalLoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}


