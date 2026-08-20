import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import GlobalToastProvider from './components/Common/GlobalToastProvider'
import './styles/globals.css'
import './pages/recruiter/recruiter-mobile.css'
import '@fortawesome/fontawesome-free/css/all.min.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalToastProvider>
      <App />
    </GlobalToastProvider>
  </React.StrictMode>
)

// Remove the HTML splash screen once the app has mounted and signal readiness
function removeSplashSoon() {
  const remove = () => {
    const splash = document.getElementById('splash-screen')
    if (splash) {
      splash.style.transition = 'opacity 0.35s ease'
      splash.style.opacity = '0'
      setTimeout(() => {
        splash.remove()
      }, 400)
    }
    document.body.classList.add('app-ready')
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(remove, 200)
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(remove, 200))
  }
}

removeSplashSoon()
