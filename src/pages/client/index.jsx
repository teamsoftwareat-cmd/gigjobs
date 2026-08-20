import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlus, faDownload, faCheckDouble } from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, CardHeader, PageHeader, Tag, DataTable, Tabs, Modal, ProgressBar } from '../../components/ui/index'
import { useAlert } from '../../context/AlertContext'
import { AttendanceDoughnut } from '../../components/ui/Charts'
// import { clientAPI } from '../../api/axios'
import { postJobSchema } from '../../schemas/validations'

/* ===== CLIENT DASHBOARD ===== */
export function ClientDashboard() {
  const [showJobModal, setShowJobModal] = useState(false)

  return (
    <div>
      <PageHeader
        title="Client Dashboard"
        subtitle="Hexaware Technologies Pvt. Ltd"
        action={
          <button className="btn btn-primary btn-sm" onClick={() => setShowJobModal(true)}>
            <FontAwesomeIcon icon={faPlus} /> Post New Job
          </button>
        }
      />

      <div className="stats-grid">
        <StatCard icon="👥" iconStyle={{ background:'var(--teal-light)', color:'var(--teal)', fontSize:20 }} value="47" label="Active Workers" change="Across 3 projects" changeType="up" />
        <StatCard icon="📅" iconStyle={{ background:'var(--green-light)', color:'var(--green)', fontSize:20 }} value="92%" label="Avg Attendance" change="This month" changeType="up" />
        <StatCard icon="🧾" iconStyle={{ background:'var(--saffron-light)', color:'var(--saffron)', fontSize:20 }} value="₹3.4L" label="Invoice This Month" change="Due Mar 31" changeType="down" />
        <StatCard icon="💼" iconStyle={{ background:'var(--purple-light)', color:'var(--purple)', fontSize:20 }} value="3" label="Open Job Orders" change="8 positions to fill" changeType="up" />
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="📋 Active Job Orders" action={<button className="btn btn-primary btn-sm" onClick={() => setShowJobModal(true)}>+ Post Job</button>} />
          {[
            { title:'Customer Support Executive', meta:'Guindy | 9AM-2PM | ₹700/day', filled:12, total:20, color:'var(--saffron)', tag:'Part-Time', variant:'teal' },
            { title:'Data Entry Operators', meta:'Thoraipakkam | ₹800/day', filled:5, total:10, color:'var(--teal)', tag:'Temp', variant:'yellow' },
          ].map((j) => (
            <div key={j.title} style={{ border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{j.title}</div>
                  <div className="text-sm text-muted">{j.meta}</div>
                </div>
                <Tag variant={j.variant}>{j.tag}</Tag>
              </div>
              <div className="flex gap-12 mt-16" style={{ alignItems:'center' }}>
                <div className="text-sm"><strong>{j.filled}/{j.total}</strong> filled</div>
                <div style={{ flex:1 }}><ProgressBar value={(j.filled/j.total)*100} color={j.color} /></div>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="📊 Attendance Overview" />
          <AttendanceDoughnut />
        </Card>
      </div>

      <Card>
        <CardHeader title="🧾 Recent Invoices" action={<button className="btn btn-outline btn-sm">View All</button>} />
        <DataTable
          columns={['Invoice #', 'Period', 'Amount', 'Status']}
          rows={[
            [<strong>INV-2025-031</strong>, 'Mar 1-15', <strong>₹1,72,000</strong>, <Tag variant="yellow">Due Mar 31</Tag>],
            [<strong>INV-2025-024</strong>, 'Feb Full', <strong>₹3,20,000</strong>, <Tag variant="green">Paid ✓</Tag>],
            [<strong>INV-2025-017</strong>, 'Jan Full', <strong>₹2,88,000</strong>, <Tag variant="green">Paid ✓</Tag>],
          ]}
        />
        <button className="btn btn-primary w-full" style={{ marginTop:12 }}>💳 Pay via Razorpay</button>
      </Card>

      <PostJobModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} />
    </div>
  )
}

/* ===== CLIENT ATTENDANCE ===== */
export function ClientAttendance() {
  const [activeTab, setActiveTab] = useState('today')
  const { alert } = useAlert()
  const TABS = [{ id:'today', label:'Today' }, { id:'week', label:'This Week' }, { id:'month', label:'This Month' }, { id:'exceptions', label:'Exceptions (3)' }]

  /* ===== PATCH /client/attendance/:id/approve ===== */
  const approve = async (id) => {
    try { await clientAPI.approveAttendance(id) } catch {}
    alert('Attendance approved!')
  }

  return (
    <div>
      <PageHeader
        title="Attendance Management"
        subtitle="Customer Support Team — Guindy Site"
        action={
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm"><FontAwesomeIcon icon={faDownload} /> Export Timesheet</button>
            <button className="btn btn-primary btn-sm"><FontAwesomeIcon icon={faCheckDouble} /> Approve All</button>
          </div>
        }
      />
      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />
      {activeTab === 'today' ? (
        <Card>
          <DataTable
            columns={['Worker', 'Clock In', 'Clock Out', 'Hours', 'Location', 'Status', 'Action']}
            rows={[
              [<WCell initials="AK" bg="var(--teal)" name="Arjun Kumar" />, '9:02 AM', '6:04 PM', '9h 2m', <Tag variant="green">In Zone ✓</Tag>, <Tag variant="green">Present</Tag>, <button className="btn btn-green btn-sm" onClick={() => approve('att_001')}>Approve</button>],
              [<WCell initials="RK" bg="var(--saffron)" name="Ravi Kumar" />, '9:18 AM', '—', 'In Progress', <Tag variant="green">In Zone ✓</Tag>, <Tag variant="blue">Active</Tag>, <button className="btn btn-outline btn-sm">View</button>],
              [<WCell initials="MP" bg="var(--purple)" name="Meena Prabhu" />, '—', '—', '—', '—', <Tag variant="red">Absent</Tag>, <button className="btn btn-outline btn-sm">Mark Leave</button>],
            ]}
          />
        </Card>
      ) : (
        <Card><p className="text-muted" style={{ padding:16 }}>
          {activeTab === 'week' && 'Weekly view here…'}
          {activeTab === 'month' && 'Monthly timesheet here…'}
          {activeTab === 'exceptions' && 'Exception cases here…'}
        </p></Card>
      )}
    </div>
  )
}

/* ===== POST JOB MODAL with Zod ===== */
function PostJobModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ title:'', segment:'Part-Time', location:'Guindy', headcount:'', shift:'Day (9AM-6PM)', dailyRate:'', startDate:'', endDate:'', skills:'' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  /* ===== POST /client/jobs ===== */
  const handleSubmit = async () => {
    const result = postJobSchema.safeParse(form)
    if (!result.success) {
      const errs = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    setErrors({})
    try { await clientAPI.postJob(form) } catch {}
    setSuccess(true)
    setTimeout(() => { onClose(); setSuccess(false) }, 1400)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post New Job Order"
      footer={!success && <><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}><FontAwesomeIcon icon={faPlus} /> Post Job</button></>}>
      {success ? <div className="alert-success">✓ Job posted successfully!</div> : (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input className={`form-control${errors.title?' invalid':''}`} placeholder="e.g. Customer Support Executive" value={form.title} onChange={set('title')} />
              {errors.title && <div className="field-error">{errors.title}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Segment</label>
              <select className="form-control" value={form.segment} onChange={set('segment')}><option>Part-Time</option><option>Internship</option><option>Temporary</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-control" value={form.location} onChange={set('location')}><option>Guindy</option><option>OMR</option><option>Tambaram</option><option>Anna Nagar</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Headcount Required</label>
              <input className={`form-control${errors.headcount?' invalid':''}`} type="number" placeholder="e.g. 10" value={form.headcount} onChange={set('headcount')} />
              {errors.headcount && <div className="field-error">{errors.headcount}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Daily Rate (₹)</label>
              <input className={`form-control${errors.dailyRate?' invalid':''}`} type="number" placeholder="e.g. 700" value={form.dailyRate} onChange={set('dailyRate')} />
              {errors.dailyRate && <div className="field-error">{errors.dailyRate}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className={`form-control${errors.startDate?' invalid':''}`} type="date" value={form.startDate} onChange={set('startDate')} />
              {errors.startDate && <div className="field-error">{errors.startDate}</div>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Skills Required</label>
            <input className={`form-control${errors.skills?' invalid':''}`} placeholder="e.g. MS Office, Customer Handling, Tamil & English" value={form.skills} onChange={set('skills')} />
            {errors.skills && <div className="field-error">{errors.skills}</div>}
          </div>
        </>
      )}
    </Modal>
  )
}

function WCell({ initials, bg, name }) {
  return <div className="flex items-center gap-8"><div className="avatar av-sm" style={{ background:bg }}>{initials}</div><strong>{name}</strong></div>
}
