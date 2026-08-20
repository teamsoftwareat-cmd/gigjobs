import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMapMarkerAlt, faBolt, faShieldAlt, faUserCheck } from '@fortawesome/free-solid-svg-icons'
import LoginModal from './auth/LoginModal'
import './Landing.css'
import SupportRequestModal from '../components/SupportRequestModal'


export default function Landing() {
  const [showLogin, setShowLogin] = useState(false)
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div id="landing" className="candidate-landing">
      {/* ===== Navbar ===== */}
      <nav className="land-nav">
        <div className="nav-left">
          <div className="logo-box">CY</div>
          <div>
            <div className="logo-title">Cynosurejobs.net</div>
            <div className="logo-sub">Candidate Portal</div>
          </div>
        </div>

        <div className="land-nav-links">
          <a href="#jobs">Jobs</a>
          <a href="#features">Why Choose Us</a>
          <a href="#contact">Contact</a>
        </div>

        <button style={{ display: 'none' }} className="btn-login" onClick={() => navigate('/internal')}>
          Internal Login
        </button>
      </nav>

      {/* ===== Hero ===== */}
      <section className="land-hero">
        <div className="land-tag">
          <FontAwesomeIcon icon={faMapMarkerAlt} /> Candidate-first hiring experience
        </div>

        <h1 className="land-h1">
          Find gigs, shifts and <span>opportunities</span> fast.
        </h1>

        <p className="land-sub">
          Apply to verified roles, track status instantly, and grow your profile with
          trusted employers in Chennai and beyond.
        </p>

        <div className="hero-actions">
          <button className="btn-primary" onClick={() => setShowLogin(true)}>
            Candidate Sign In
          </button>
          <button className="btn-secondary" style={{display: 'none'}} onClick={() => navigate('/attendance')}>
            Mark Attendance
          </button>
          <button className="btn-tertiary" onClick={() => navigate('/register')}>
            Candidate Register
          </button>
          <button className="btn-tertiary" style={{display: 'none'}} onClick={() => window.location.assign('#jobs')}>
            Explore Jobs
          </button>
          <button className="btn btn-outline" onClick={() => setIsSupportModalOpen(true)}>
  Contact Support
</button>
        </div>

        <div className="land-stats">
          <div>
            <strong>5L+</strong>
            <span>Registered Candidates</span>
          </div>
          <div>
            <strong>500+</strong>
            <span>Trusted Employers</span>
          </div>
          <div>
            <strong>20K+</strong>
            <span>Successful Placements</span>
          </div>
          <div>
            <strong>98%</strong>
            <span>Verified Jobs</span>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="feature-card">
          <FontAwesomeIcon icon={faBolt} />
          <h3>Fast applications</h3>
          <p>One-click apply, real-time status updates, and support at every step.</p>
        </div>
        <div className="feature-card">
          <FontAwesomeIcon icon={faUserCheck} />
          <h3>Verified employers</h3>
          <p>Work with trusted companies and staffing partners across the region.</p>
        </div>
        <div className="feature-card">
          <FontAwesomeIcon icon={faShieldAlt} />
          <h3>Safe hiring</h3>
          <p>Secure data, payroll support, and compliance tracking for every role.</p>
        </div>
      </section>

      {/* ===== Login Modal ===== */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
        <SupportRequestModal 
  isOpen={isSupportModalOpen} 
  onClose={() => setIsSupportModalOpen(false)} 
/>
    </div>
  )
}

