import React from 'react'

const MaintenancePage = ({
  title = 'We\'ll be right back',
  subtitle = 'This page is currently under maintenance.',
  message = 'Please check back shortly. We are making improvements to bring you a better experience.',
}) => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(135deg, #f7fafc 0%, #e8f4f7 100%)',
      fontFamily: 'Sora, sans-serif',
      color: '#0f172a',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: '#fff',
        borderRadius: '24px',
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
        padding: '36px 28px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          margin: '0 auto 20px',
          borderRadius: '50%',
          background: 'rgba(14, 124, 134, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
        }}>
          🔧
        </div>

        <h1 style={{ margin: '0 0 10px', fontSize: '28px', fontWeight: 700 }}>{title}</h1>
        <p style={{ margin: '0 0 10px', fontSize: '16px', color: '#475569', lineHeight: 1.6 }}>{subtitle}</p>
        <p style={{ margin: '0', fontSize: '14px', color: '#64748b', lineHeight: 1.7 }}>{message}</p>
      </div>
    </div>
  )
}

export default MaintenancePage
