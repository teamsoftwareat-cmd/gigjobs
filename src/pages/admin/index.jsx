import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faShieldAlt, faSave, faPlus } from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, CardHeader, PageHeader, Tag, DataTable, Modal } from '../../components/ui/index'
import { useAlert } from '../../context/AlertContext'
import { ManDaysChart } from '../../components/ui/Charts'
// import { adminAPI } from '../../api/axios'
import { addUserSchema } from '../../schemas/validations'

/* ===== ADMIN DASHBOARD ===== */
export function AdminDashboard() {
  const [showAddUser, setShowAddUser] = useState(false)
  const { alert } = useAlert()

  /* ===== PATCH /admin/kyc/:id/approve ===== */
  const approveKyc = async (id, name) => {
    try { await adminAPI.approveKyc(id) } catch {}
    alert(`KYC approved for ${name}`)
  }
  const rejectKyc = async (id, name) => {
    try { await adminAPI.rejectKyc(id) } catch {}
    alert(`KYC rejected for ${name}`)
  }

  const KYC_QUEUE = [
    { id:'kyc_001', name:'Deepa Venkat', sub:'PAN + Aadhaar submitted · 1 hr ago', initials:'DV', bg:'var(--teal)' },
    { id:'kyc_002', name:'Sundar Kumar', sub:'Bank Verification pending · 3 hrs ago', initials:'SK', bg:'var(--saffron)' },
    { id:'kyc_003', name:'Lakshmi Bai', sub:'Aadhaar XML uploaded · 5 hrs ago', initials:'LB', bg:'var(--purple)' },
  ]

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform Overview — Cynosure Corporate Solutions"
        action={
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm"><FontAwesomeIcon icon={faDownload} /> Export Report</button>
            <button className="btn btn-sm" style={{ background:'var(--green)', color:'white' }}>
              <FontAwesomeIcon icon={faShieldAlt} /> System Health: OK
            </button>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard icon="👥" iconStyle={{ background:'var(--teal-light)', color:'var(--teal)', fontSize:20 }} value="4,82,310" label="Total Candidates" change="+1,240 this week" changeType="up" />
        <StatCard icon="🏢" iconStyle={{ background:'var(--purple-light)', color:'var(--purple)', fontSize:20 }} value="487" label="Active Clients" change="12 KYC pending" changeType="up" />
        <StatCard icon="📈" iconStyle={{ background:'var(--green-light)', color:'var(--green)', fontSize:20 }} value="1,840" label="Placements (Mar YTD)" change="92% of target" changeType="up" />
        <StatCard icon="₹" iconStyle={{ background:'var(--saffron-light)', color:'var(--saffron)', fontWeight:800, fontSize:18 }} value="₹48.6L" label="Revenue (Mar)" change="+22% vs Feb" changeType="up" />
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="📊 Man Days vs Target (6 months)" />
          <ManDaysChart />
        </Card>
        <Card>
          <CardHeader title="⚙️ User & Role Management" action={<button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}><FontAwesomeIcon icon={faPlus} /> Add User</button>} />
          <DataTable
            columns={['User', 'Role', 'Status', 'Action']}
            rows={[
              [<UserCell name="Ramya S." email="ramya@cynosure.in" />, <Tag variant="teal">Super Admin</Tag>, <Tag variant="green">Active</Tag>, <button className="btn btn-outline btn-sm">Edit</button>],
              [<UserCell name="Venkat P." email="venkat@cynosure.in" />, <Tag variant="purple">Recruiter</Tag>, <Tag variant="green">Active</Tag>, <button className="btn btn-outline btn-sm">Edit</button>],
              [<UserCell name="Preethi R." email="preethi@cynosure.in" />, <Tag variant="yellow">Accounts</Tag>, <Tag variant="green">Active</Tag>, <button className="btn btn-outline btn-sm">Edit</button>],
              [<UserCell name="Balaji M." email="balaji@cynosure.in" />, <Tag variant="blue">Compliance</Tag>, <Tag variant="green">Active</Tag>, <button className="btn btn-outline btn-sm">Edit</button>],
            ]}
          />
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="🔍 KYC Approvals Queue" action={<Tag variant="yellow">12 Pending</Tag>} />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {KYC_QUEUE.map((k) => (
              <div key={k.id} style={{ background:'var(--bg)', borderRadius:10, padding:12, display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                <div className="flex items-center gap-12">
                  <div className="avatar av-sm" style={{ background:k.bg }}>{k.initials}</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{k.name}</div>
                    <div className="text-sm text-muted">{k.sub}</div>
                  </div>
                </div>
                <div className="flex gap-8">
                  <button className="btn btn-green btn-sm" onClick={() => approveKyc(k.id, k.name)}>Approve</button>
                  <button className="btn btn-red btn-sm" onClick={() => rejectKyc(k.id, k.name)}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="🛡 Audit Log" />
          <div className="timeline">
            {[
              { status:'done', title:'KYC Approved — Arjun Kumar', time:'by Balaji M. · Today 10:23 AM' },
              { status:'done', title:'Payroll Batch #031 Initiated — ₹28.4L', time:'by Preethi R. · Today 9:00 AM' },
              { status:'process', title:'New Client Onboarded — Freshworks', time:'by Venkat P. · Yesterday 4:30 PM' },
              { status:'pending', title:'Bulk Import — 230 candidates (Naukri)', time:'by System · Yesterday 2:00 AM' },
            ].map((item, i) => (
              <div key={i} className="tl-item">
                <div className={`tl-dot ${item.status}`} />
                <div>
                  <div className="tl-title">{item.title}</div>
                  <div className="tl-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <AddUserModal isOpen={showAddUser} onClose={() => setShowAddUser(false)} />
    </div>
  )
}

/* ===== ADMIN SETTINGS ===== */
export function AdminSettings() {
  const [config, setConfig] = useState({ platformName:'Cynosurejobs.net', locations:'Guindy, OMR, Tambaram, Anna Nagar, T.Nagar, Velachery', gracePeriod:'15' })
  const [toggles, setToggles] = useState({ razorpay:true, whatsapp:true, aiResume:true, kyc:true })
  const [saved, setSaved] = useState(false)

  /* ===== PUT /admin/settings ===== */
  const handleSave = async () => {
    try { await adminAPI.updateSettings({ ...config, integrations: toggles }) } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <PageHeader title="Platform Settings" subtitle="Admin Module" />
      {saved && <div className="alert-success" style={{ marginBottom:16 }}>✓ Settings saved successfully!</div>}
      <div className="grid-2">
        <Card>
          <CardHeader title="⚙️ Platform Configuration" />
          <div className="form-group">
            <label className="form-label">Platform Name</label>
            <input className="form-control" value={config.platformName} onChange={(e) => setConfig({ ...config, platformName:e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Chennai Micro-Locations</label>
            <textarea className="form-control" rows={3} value={config.locations} onChange={(e) => setConfig({ ...config, locations:e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Attendance Grace Period (mins)</label>
            <input className="form-control" type="number" value={config.gracePeriod} onChange={(e) => setConfig({ ...config, gracePeriod:e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleSave}><FontAwesomeIcon icon={faSave} /> Save Configuration</button>
        </Card>
        <Card>
          <CardHeader title="🔗 Integration Settings" />
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { key:'razorpay', label:'RazorpayX Payouts', sub:'Payout API connected' },
              { key:'whatsapp', label:'WhatsApp (Gupshup)', sub:'Campaign messaging active' },
              { key:'aiResume', label:'AI Resume Parser', sub:'Auto-parse uploaded CVs' },
              { key:'kyc', label:'KYC API (Cashfree)', sub:'PAN + Bank verification' },
            ].map(({ key, label, sub }) => (
              <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'var(--bg)', borderRadius:10 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{label}</div>
                  <div className="text-sm text-muted">{sub}</div>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={toggles[key]} onChange={() => setToggles({ ...toggles, [key]:!toggles[key] })} />
                  <span className="slider" />
                </label>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ===== ADD USER MODAL with Zod ===== */
function AddUserModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name:'', email:'', mobile:'', role:'Recruiter / Operations' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  /* ===== POST /admin/users ===== */
  const handleSubmit = async () => {
    const result = addUserSchema.safeParse(form)
    if (!result.success) {
      const errs = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    setErrors({})
    try { await adminAPI.addUser(form) } catch {}
    setSuccess(true)
    setTimeout(() => { onClose(); setSuccess(false); setForm({ name:'', email:'', mobile:'', role:'Recruiter / Operations' }) }, 1400)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Staff User"
      footer={!success && <><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Create User & Send Invite</button></>}>
      {success ? <div className="alert-success">✓ User created and invite sent!</div> : (
        <div className="form-row">
          {[{label:'Full Name',key:'name',placeholder:'Staff member name',type:'text'},{label:'Email',key:'email',placeholder:'name@cynosure.in',type:'email'},{label:'Mobile',key:'mobile',placeholder:'9876543210',type:'tel'}].map(({ label, key, placeholder, type }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input className={`form-control${errors[key]?' invalid':''}`} type={type} placeholder={placeholder} value={form[key]} onChange={set(key)} />
              {errors[key] && <div className="field-error">{errors[key]}</div>}
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-control" value={form.role} onChange={set('role')}>
              <option>Recruiter / Operations</option><option>Accounts / Finance</option><option>Compliance / KYC</option><option>Super Admin</option>
            </select>
          </div>
        </div>
      )}
    </Modal>
  )
}

function UserCell({ name, email }) {
  return <div><strong>{name}</strong><br /><span className="text-muted text-sm">{email}</span></div>
}


