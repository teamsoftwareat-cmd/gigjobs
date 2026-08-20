import React from 'react'
import { PageHeader } from '../../components/ui'

export default function CandidateReferAndEarnPage() {
  return (
    <div>
      <PageHeader
        title="Refer & Earn"
        subtitle="Refer friends and earn rewards!"
      />
      <div style={{ padding: '20px' }}>
        <p>Referral program details and your referral code will be here.</p>
        {/* TODO: Implement referral logic and UI */}
      </div>
    </div>
  )
}