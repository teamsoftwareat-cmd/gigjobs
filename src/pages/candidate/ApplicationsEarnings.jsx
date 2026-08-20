import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faDownload } from '@fortawesome/free-solid-svg-icons'
import { Card, PageHeader, Tag, DataTable, Tabs } from '../../components/ui/index'
import { EarningsLineChart } from '../../components/ui/Charts'
import { candidateAPI } from '../../api/axios'

export function CandidateApplications() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')

  const TABS = [
    { id: 'all', label: 'All (12)' },
    { id: 'active', label: 'Active (3)' },
    { id: 'interview', label: 'Interviews (2)' },
    { id: 'offered', label: 'Offered (1)' },
    { id: 'closed', label: 'Closed (6)' },
  ]

  const ALL_ROWS = [
    [<strong key="h">Hexaware Tech</strong>, 'Customer Support', <Tag variant="teal">Part-Time</Tag>, 'Guindy', 'Mar 18', <Tag variant="yellow">Interview Sched.</Tag>, <button className="btn btn-outline btn-sm">View</button>],
    [<strong key="s">Shopify India</strong>, 'Cust. Support Exec', <Tag variant="teal">Part-Time</Tag>, 'Guindy', 'Mar 15', <Tag variant="green">Selected</Tag>, <button className="btn btn-green btn-sm">Accept Offer</button>],
    [<strong key="z">Zoho Corp</strong>, 'QA Intern', <Tag variant="green">Internship</Tag>, 'Siruseri', 'Mar 14', <Tag variant="blue">Under Review</Tag>, <button className="btn btn-outline btn-sm">View</button>],
    [<strong key="t">TVS Group</strong>, 'Admin Asst', <Tag variant="teal">Part-Time</Tag>, 'Ambattur', 'Mar 10', <Tag variant="red">Rejected</Tag>, <button className="btn btn-outline btn-sm">Feedback</button>],
    [<strong key="a">Apollo Hospitals</strong>, 'Records Intern', <Tag variant="green">Internship</Tag>, 'Greams Rd', 'Mar 6', <Tag variant="yellow">Shortlisted</Tag>, <button className="btn btn-outline btn-sm">View</button>],
  ]

  return (
    <div>
      <PageHeader
        title="My Applications"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/app/candidate/jobs')}>
            <FontAwesomeIcon icon={faPlus} /> Apply New Job
          </button>
        }
      />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      <Card>
        {activeTab === 'all' ? (
          <DataTable columns={['Company','Role','Type','Location','Applied','Status','Action']} rows={ALL_ROWS} />
        ) : (
          <p className="text-muted" style={{ padding: 16 }}>
            {activeTab === 'active' && 'Active applications shown here…'}
            {activeTab === 'interview' && 'Upcoming interviews listed here…'}
            {activeTab === 'offered' && 'Job offers pending acceptance…'}
            {activeTab === 'closed' && 'Past closed applications…'}
          </p>
        )}
      </Card>
    </div>
  )
}

export function CandidateEarnings() {
  useEffect(() => {
    candidateAPI.getEarnings('usr_001').then(() => {}).catch(() => {})
  }, [])

  return (
    <div>
      <PageHeader
        title="Earnings & Payouts"
        subtitle="Track your income and payment history"
        action={<button className="btn btn-outline btn-sm"><FontAwesomeIcon icon={faDownload} /> Download Statement</button>}
      />
      <div className="payroll-hero">
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginBottom:4, textTransform:'uppercase', letterSpacing:1 }}>Total Earnings — March 2025</div>
        <div className="payroll-amount">Rs 14,400</div>
        <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13, marginTop:4 }}>18 man days x Rs 800/day at Shopify India</div>
        <div className="pay-breakdown">
          <div className="pay-item"><div className="pay-item-label">Gross Earned</div><div className="pay-item-val">Rs 14,400</div></div>
          <div className="pay-item"><div className="pay-item-label">TDS Deducted</div><div className="pay-item-val">Rs 0</div></div>
          <div className="pay-item"><div className="pay-item-label">Net Payable</div><div className="pay-item-val" style={{ color:'#FFB84D' }}>Rs 14,400</div></div>
        </div>
      </div>
      <div className="grid-2">
        <Card>
          <div className="card-header"><div className="card-title">Monthly Earnings Chart</div></div>
          <EarningsLineChart />
        </Card>
        <Card>
          <div className="card-header"><div className="card-title">Payout History</div></div>
          <DataTable
            columns={['Date','Amount','Project','Status']}
            rows={[
              ['Mar 1', <span key="m1" className="text-green font-bold">Rs 9,600</span>, 'Shopify Feb Batch', <Tag variant="green">Credited</Tag>],
              ['Feb 1', <span key="f1" className="text-green font-bold">Rs 12,000</span>, 'Shopify Jan Batch', <Tag variant="green">Credited</Tag>],
              ['Jan 2', <span key="j2" className="text-green font-bold">Rs 8,000</span>, 'Hexaware Dec', <Tag variant="green">Credited</Tag>],
              ['Dec 3', <span key="d3" className="text-green font-bold">Rs 6,600</span>, 'TVS Nov', <Tag variant="green">Credited</Tag>],
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
