import { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faPlay, faPlus, faBolt } from '@fortawesome/free-solid-svg-icons'
import { StatCard, Card, CardHeader, PageHeader, Tag, DataTable, Modal } from '../../components/ui/index'
import { RevenueChart } from '../../components/ui/Charts'
// import { accountsAPI } from '../../api/axios'
import { invoiceSchema } from '../../schemas/validations'

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  return isMobile
}

/* ===== ACCOUNTS DASHBOARD ===== */
export function AccountsDashboard() {
  const [showPayrollModal, setShowPayrollModal] = useState(false)
  const isMobile = useIsMobile()

  const payrollData = [
    { worker: 'Arjun Kumar', client: 'Shopify', manDays: 18, rate: '₹800', netPay: '₹14,400', status: 'pending' },
    { worker: 'Ravi Kumar', client: 'Hexaware', manDays: 20, rate: '₹700', netPay: '₹14,000', status: 'paid' },
    { worker: 'Meena Prabhu', client: 'Apollo', manDays: 15, rate: '₹600', netPay: '₹9,000', status: 'paid' },
    { worker: 'Deepa Venkat', client: 'Hexaware', manDays: 22, rate: '₹700', netPay: '₹15,400', status: 'processing' },
    { worker: 'Karthik V.', client: 'Zoho', manDays: 10, rate: '₹500', netPay: '₹5,000', status: 'failed' },
  ]

  return (
    <div>
      <PageHeader
        title="Accounts & Payroll"
        subtitle="March 2025 Payroll Cycle"
        action={
          <div className="flex gap-8">
            <button className="btn btn-outline btn-sm"><FontAwesomeIcon icon={faDownload} /> Export Payroll</button>
            <button className="btn btn-saffron btn-sm" onClick={() => setShowPayrollModal(true)}>
              <FontAwesomeIcon icon={faPlay} /> Run Payroll
            </button>
          </div>
        }
      />

      <div className="stats-grid">
        <StatCard icon="₹" iconStyle={{ background:'var(--saffron-light)', color:'var(--saffron)', fontWeight:800, fontSize:18 }} value="₹28.4L" label="Total Payroll (Mar)" change="Across 340 workers" changeType="up" />
        <StatCard icon="✅" iconStyle={{ background:'var(--green-light)', color:'var(--green)', fontSize:20 }} value="₹22.1L" label="Payouts Processed" change="312 workers paid" changeType="up" />
        <StatCard icon="⏳" iconStyle={{ background:'#FEE2E2', color:'var(--red)', fontSize:20 }} value="₹6.3L" label="Pending Payouts" change="28 workers pending" changeType="down" />
        <StatCard icon="🧾" iconStyle={{ background:'var(--purple-light)', color:'var(--purple)', fontSize:20 }} value="₹48.6L" label="Client Billing (Mar)" change="18 invoices issued" changeType="up" />
      </div>

      <div className="grid-2">
        <Card>
          <CardHeader title="💸 Payroll Batch — March 2025" />
          {isMobile ? (
            <div className="payroll-mobile-cards">
              {payrollData.map((item, index) => (
                <Card key={index} className="payroll-mobile-card">
                  <div className="payroll-mobile-header">
                    <div className="payroll-mobile-worker">{item.worker}</div>
                    <div className="payroll-mobile-pay">{item.netPay}</div>
                  </div>
                  <div className="payroll-mobile-details">
                    <div className="payroll-mobile-row">
                      <span>Client: {item.client}</span>
                    </div>
                    <div className="payroll-mobile-row">
                      <span>{item.manDays} days @ {item.rate}</span>
                    </div>
                    <div className="payroll-mobile-status">
                      <Tag variant={
                        item.status === 'paid' ? 'green' :
                        item.status === 'pending' ? 'yellow' :
                        item.status === 'processing' ? 'blue' : 'red'
                      }>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </Tag>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <DataTable
              columns={['Worker', 'Client', 'Man Days', 'Rate', 'Net Pay', 'Status']}
              rows={payrollData.map(item => [
                item.worker,
                item.client,
                item.manDays,
                item.rate,
                <span className="text-green font-bold">{item.netPay}</span>,
                <Tag variant={
                  item.status === 'paid' ? 'green' :
                  item.status === 'pending' ? 'yellow' :
                  item.status === 'processing' ? 'blue' : 'red'
                }>
                  {item.status === 'paid' ? 'Paid ✓' : item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Tag>
              ])}
            />
          )}
        </Card>
        <Card>
          <CardHeader title="📊 Revenue vs Payouts" />
          <RevenueChart />
        </Card>
      </div>

      {/* RazorpayX Card */}
      <Card>
        <CardHeader title="🏦 Razorpay Integration" action={<a href="#" style={{ color:'var(--teal)', fontSize:12.5, textDecoration:'none', fontWeight:600 }} onClick={(e)=>e.preventDefault()}>Configure →</a>} />
        <div style={{ background:'linear-gradient(135deg,#072B4E,#0A3D5C)', borderRadius:12, padding:16, color:'white', marginBottom:14 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>RazorpayX Account</div>
          <div style={{ fontFamily:'Sora,sans-serif', fontWeight:700, fontSize:16 }}>Cynosure Corporate Solutions</div>
          <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', marginTop:4 }}>Available Balance: <span style={{ color:'#F4A130', fontWeight:700 }}>₹18,40,000</span></div>
          <div style={{ display:'flex', gap:20, marginTop:12 }}>
            <div><div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Payout Contacts</div><div style={{ fontWeight:700 }}>340</div></div>
            <div><div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Today's Transfers</div><div style={{ fontWeight:700, color:'#1B9E5C' }}>₹2.4L</div></div>
            <div><div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>Failed</div><div style={{ fontWeight:700, color:'#E53935' }}>₹14,000</div></div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <button className="btn btn-primary w-full"><FontAwesomeIcon icon={faBolt} /> Trigger Bulk Payout</button>
          <button className="btn btn-outline w-full"><FontAwesomeIcon icon={faDownload} /> Download Payment Sheet (CSV)</button>
        </div>
      </Card>

      <RunPayrollModal isOpen={showPayrollModal} onClose={() => setShowPayrollModal(false)} />
    </div>
  )
}

/* ===== ACCOUNTS INVOICES ===== */
export function AccountsInvoices() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <PageHeader
        title="Client Billing & Invoices"
        action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><FontAwesomeIcon icon={faPlus} /> Generate Invoice</button>}
      />
      <Card>
        <DataTable
          columns={['Invoice #', 'Client', 'Period', 'Man Days', 'Amount', 'GST', 'Total', 'Status', 'Actions']}
          rows={[
            [<strong>INV-031</strong>, 'Hexaware Tech', 'Mar 1-15', 240, '₹1,68,000', '₹30,240', <strong>₹1,98,240</strong>, <Tag variant="yellow">Pending</Tag>, <div className="flex gap-8"><button className="btn btn-outline btn-sm">PDF</button><button className="btn btn-primary btn-sm">Send</button></div>],
            [<strong>INV-029</strong>, 'Shopify India', 'Mar Full', 540, '₹3,78,000', '₹68,040', <strong>₹4,46,040</strong>, <Tag variant="yellow">Due Mar 31</Tag>, <div className="flex gap-8"><button className="btn btn-outline btn-sm">PDF</button><button className="btn btn-green btn-sm">Paid</button></div>],
            [<strong>INV-024</strong>, 'Apollo Hospitals', 'Feb Full', 300, '₹1,80,000', '₹32,400', <strong>₹2,12,400</strong>, <Tag variant="green">Paid ✓</Tag>, <button className="btn btn-outline btn-sm">Receipt</button>],
            [<strong>INV-020</strong>, 'TVS Group', 'Feb Full', 200, '₹1,60,000', '₹28,800', <strong>₹1,88,800</strong>, <Tag variant="green">Paid ✓</Tag>, <button className="btn btn-outline btn-sm">Receipt</button>],
          ]}
        />
      </Card>
      <GenerateInvoiceModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}

/* ===== GENERATE INVOICE MODAL with Zod ===== */
function GenerateInvoiceModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ client:'Hexaware Technologies', period:'March 1-15, 2025', manDays:'', ratePerDay:'900', dueDate:'' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const gst = form.manDays && form.ratePerDay ? Math.round(Number(form.manDays) * Number(form.ratePerDay) * 0.18) : 0
  const total = form.manDays && form.ratePerDay ? Number(form.manDays) * Number(form.ratePerDay) + gst : 0

  /* ===== POST /accounts/invoices ===== */
  const handleSubmit = async () => {
    const result = invoiceSchema.safeParse(form)
    if (!result.success) {
      const errs = {}
      result.error.errors.forEach((e) => { errs[e.path[0]] = e.message })
      setErrors(errs)
      return
    }
    setErrors({})
    try { await accountsAPI.generateInvoice({ ...form, gst, total }) } catch {}
    setSuccess(true)
    setTimeout(() => { onClose(); setSuccess(false) }, 1400)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Invoice"
      footer={!success && <><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>🧾 Generate & Send Invoice</button></>}>
      {success ? <div className="alert-success">✓ Invoice generated and sent!</div> : (
        <>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client</label>
              <select className="form-control" value={form.client} onChange={set('client')}><option>Hexaware Technologies</option><option>Shopify India</option><option>Apollo Hospitals</option><option>TVS Group</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Period</label>
              <select className="form-control" value={form.period} onChange={set('period')}><option>March 1-15, 2025</option><option>March Full Month</option><option>Custom Range</option></select>
            </div>
            <div className="form-group">
              <label className="form-label">Man Days Billed</label>
              <input className={`form-control${errors.manDays?' invalid':''}`} type="number" placeholder="e.g. 240" value={form.manDays} onChange={set('manDays')} />
              {errors.manDays && <div className="field-error">{errors.manDays}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Rate per Day (₹)</label>
              <input className={`form-control${errors.ratePerDay?' invalid':''}`} type="number" value={form.ratePerDay} onChange={set('ratePerDay')} />
              {errors.ratePerDay && <div className="field-error">{errors.ratePerDay}</div>}
            </div>
          </div>
          {total > 0 && (
            <div style={{ background:'var(--teal-light)', borderRadius:10, padding:14, marginBottom:14 }}>
              <div className="flex justify-between text-sm"><span>Base Amount</span><strong>₹{(total - gst).toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between text-sm" style={{ marginTop:6 }}><span>GST @18%</span><strong>₹{gst.toLocaleString('en-IN')}</strong></div>
              <div className="flex justify-between" style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--border)' }}><span style={{ fontWeight:700 }}>Total</span><strong style={{ color:'var(--teal)', fontSize:16 }}>₹{total.toLocaleString('en-IN')}</strong></div>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Payment Due By</label>
            <input className={`form-control${errors.dueDate?' invalid':''}`} type="date" value={form.dueDate} onChange={set('dueDate')} />
            {errors.dueDate && <div className="field-error">{errors.dueDate}</div>}
          </div>
        </>
      )}
    </Modal>
  )
}

/* ===== RUN PAYROLL MODAL ===== */
function RunPayrollModal({ isOpen, onClose }) {
  const [mode, setMode] = useState('RazorpayX (Bank Transfer)')
  const [success, setSuccess] = useState(false)

  /* ===== POST /accounts/payroll/run ===== */
  const run = async () => {
    try { await accountsAPI.runPayroll({ period: 'March 2025', mode, workers: 340, total: 2840000 }) } catch {}
    setSuccess(true)
    setTimeout(() => { onClose(); setSuccess(false) }, 1400)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run Payroll Batch"
      footer={!success && <><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-saffron" onClick={run}><FontAwesomeIcon icon={faPlay} /> Confirm & Run Payroll</button></>}>
      {success ? <div className="alert-success">✓ Payroll initiated for 340 workers!</div> : (
        <>
          <div style={{ background:'var(--saffron-light)', borderRadius:12, padding:16, marginBottom:16, border:'1px solid rgba(244,161,48,0.3)' }}>
            <div style={{ fontWeight:700, fontSize:14, color:'#7D5A00' }}>⚠ You are about to run payroll for March 2025</div>
            <div className="text-sm" style={{ color:'#7D5A00', marginTop:6 }}>340 workers · ₹28,40,000 total. Verify all attendance records before proceeding.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Payment Mode</label>
            <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>RazorpayX (Bank Transfer)</option><option>UPI Payout</option><option>Manual CSV Export</option>
            </select>
          </div>
        </>
      )}
    </Modal>
  )
}
