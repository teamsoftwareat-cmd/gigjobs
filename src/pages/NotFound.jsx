import React from 'react'
import { useLocation } from 'react-router-dom'
import './NotFound.css'

export default function NotFound() {
  const location = useLocation()
  const homeHref = location.pathname.startsWith('/app/recruiter') ? '#/internal' : '#/'

  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-left">
          <lottie-player src="https://assets10.lottiefiles.com/packages/lf20_ydo1amjm.json" background="transparent" speed="1" loop autoplay></lottie-player>
          <h2>404 — Page Not Found</h2>
          <p>Looks like the page you're trying to reach doesn't exist.</p>
          <a className="btn secondary" style={{ width: 'fit-content'}} href={homeHref}>Go home</a>
        </div>
      </div>
    </div>
  )
}
