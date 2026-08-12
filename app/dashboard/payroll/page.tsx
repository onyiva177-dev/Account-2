'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Play, Users, DollarSign, Calculator,
  CheckCircle2, UserX, X, BookOpen, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { exportPayslips } from '@/lib/exportPayslips'

export default function PayrollPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [employees,    setEmployees]    = useState<any[]>([])
  const [payrollLines, setPayrollLines] = useState<any[]>([])
  const [currentRun,   setCurrentRun]   = useState<any>(null)
  const [loading,      setLoading]      = useState(true)
  const [running,      setRunning]      = useState(false)
  const [processing,   setProcessing]   = useState(false)
  const [showAdd,      setShowAdd]      = useState(false)
  const [savingEmp,    setSavingEmp]    = useState(false)
  const [empForm, setEmpForm] = useState({
    full_name:'', email:'', phone:'', employee_number:'',
    department:'', job_title:'', employment_type:'full_time',
    gross_salary:'', tax_pin:'', nhif_number:'', nssf_number:'',
    hire_date: new Date().toISOString().split('T')[0],
  })

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: emps } = await supabase.from('employees')
      .select('*, contact:contacts(name,email)').eq('organization_id', organization!.id).eq('is_active', true)
    setEmployees(emps || [])
    const { data: run } = await supabase.from('payroll_runs')
      .select('*, payroll_lines(*, employee:employees(*, contact:contacts(name)))')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (run) { setCurrentRun(run); setPayrollLines(run.payroll_lines || []) }
    setLoading(false)
  }

  const saveEmployee = async () => {
    if (!empForm.full_name || !empForm.gross_salary || !empForm.employee_number)
      return toast.error('Name, employee number and salary required')
    setSavingEmp(true)
    const { data: contact, error: ce } = await supabase.from('contacts').insert({
      organization_id: organization!.id, type:'employee',
      contact_type:'employee', name:empForm.full_name,
      email:empForm.email, phone:empForm.phone
    }).select().single()
    if (ce) { toast.error('Failed: '+ce.message); setSavingEmp(false); return }
    await supabase.from('employees').insert({
      organization_id: organization!.id, contact_id: contact.id,
      employee_number: empForm.employee_number, department: empForm.department,
      job_title: empForm.job_title, employment_type: empForm.employment_type,
      gross_salary: Number(empForm.gross_salary), tax_pin: empForm.tax_pin,
      nhif_number: empForm.nhif_number, nssf_number: empForm.nssf_number,
      hire_date: empForm.hire_date, is_active: true,
    })
    toast.success(`${empForm.full_name} added`)
    setShowAdd(false); setSavingEmp(false); load()
  }

  const computePAYE = (g: number) => {
    let t = 0
    if (g <= 24000) t = g * 0.10
    else if (g <= 32333) t = 2400 + (g-24000) * 0.25
    else if (g <= 500000) t = 4483.25 + (g-32333) * 0.30
    else t = 4483.25 + 140300 + (g-500000) * 0.325
    return Math.max(0, Math.round(t - 2400))
  }
  const computeNHIF = (g: number) => {
    if (g<6000) return 150; if (g<8000) return 300; if (g<12000) return 400
    if (g<15000) return 500; if (g<20000) return 600; if (g<25000) return 750
    if (g<30000) return 850; if (g<35000) return 900; if (g<40000) return 950
    if (g<45000) return 1000; if (g<50000) return 1100; if (g<60000) return 1200
    if (g<70000) return 1300; if (g<80000) return 1400; if (g<90000) return 1500
    if (g<100000) return 1600; return 1700
  }
  const computeNSSF = (g: number) => Math.round(Math.min(g,6000)*0.06 + Math.min(Math.max(g-6000,0),12000)*0.06)

  const runPayroll = async () => {
    if (employees.length === 0) { toast.error('No active employees'); return }
    setRunning(true)
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const lines = employees.map(e => {
      const g = e.gross_salary
      const paye = computePAYE(g); const nhif = computeNHIF(g); const nssf = computeNSSF(g)
      return { employee_id:e.id, gross_pay:g, basic_pay:g, paye, nhif, nssf, net_pay:g-paye-nhif-nssf }
    })
    const totals = lines.reduce((a,l) => ({
      gross: a.gross+l.gross_pay, paye: a.paye+l.paye,
      nhif: a.nhif+l.nhif, nssf: a.nssf+l.nssf, net: a.net+l.net_pay
    }), { gross:0, paye:0, nhif:0, nssf:0, net:0 })

    const { data: run, error } = await supabase.from('payroll_runs').insert({
      organization_id: organization!.id, period,
      start_date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      end_date: new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().split('T')[0],
      status: 'draft',
      total_gross: totals.gross, total_paye: totals.paye,
      total_nhif: totals.nhif, total_nssf: totals.nssf, total_net: totals.net
    }).select().single()

    if (error) { toast.error('Failed: '+error.message); setRunning(false); return }
    await supabase.from('payroll_lines').insert(lines.map(l => ({ ...l, payroll_run_id: run.id })))
    toast.success(`Payroll run created for ${period}`)
    setRunning(false); load()
  }

  const approvePayroll = async () => {
    if (!currentRun) return
    setProcessing(true)

    // 1. Auto-create journal entry via RPC
    const { data: entryId, error: jeError } = await supabase.rpc('fn_payroll_journal', {
      p_run_id: currentRun.id,
      p_org_id: organization!.id,
    })

    if (jeError) {
      toast.error('Journal entry failed: ' + jeError.message)
      setProcessing(false); return
    }

    // 2. Create tax transactions for PAYE, NHIF, NSSF
    const totals = payrollLines.reduce((a,l) => ({
      paye: a.paye+l.paye, nhif: a.nhif+l.nhif, nssf: a.nssf+l.nssf
    }), { paye:0, nhif:0, nssf:0 })

    // Get tax policy IDs
    const { data: policies } = await supabase.from('tax_policies')
      .select('id, type').eq('organization_id', organization!.id).eq('is_active', true)

    if (policies && policies.length > 0) {
      const taxInserts = [
        { type:'paye', amount:totals.paye },
        { type:'nhif', amount:totals.nhif },
        { type:'nssf', amount:totals.nssf },
      ].filter(t => t.amount > 0).map(t => {
        const policy = policies.find(p => p.type === t.type)
        return {
          organization_id:  organization!.id,
          tax_policy_id:    policy?.id,
          taxable_amount:   currentRun.total_gross,
          tax_amount:       t.amount,
          status:           'pending',
          period_start:     currentRun.start_date,
          period_end:       currentRun.end_date,
        }
      })
      if (taxInserts.length > 0) await supabase.from('tax_transactions').insert(taxInserts)
    }

    // 3. Create a transaction record for audit trail
    await supabase.from('transactions').insert({
      organization_id: organization!.id,
      type:            'expense',
      number:          `PAY-${currentRun.period}`,
      date:            new Date().toISOString().split('T')[0],
      description:     `Payroll — ${currentRun.period}`,
      subtotal:        currentRun.total_gross,
      tax_amount:      currentRun.total_paye,
      total:           currentRun.total_gross,
      amount_paid:     currentRun.total_net,
      balance_due:     0,
      status:          'paid',
      payroll_run_id:  currentRun.id,
      journal_entry_id: entryId,
    })

    toast.success(`Payroll approved! Journal entry created (JE auto-generated)`)
    setProcessing(false); load()
  }

  const totals = payrollLines.reduce((a,l) => ({
    gross:a.gross+l.gross_pay, paye:a.paye+l.paye,
    nhif:a.nhif+l.nhif, nssf:a.nssf+l.nssf, net:a.net+l.net_pay
  }), { gross:0, paye:0, nhif:0, nssf:0, net:0 })
  const upd = (k:string,v:string) => setEmpForm(p=>({...p,[k]:v}))

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Payroll</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>
            Kenya PAYE, NHIF & NSSF — approving creates journal entries automatically
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setShowAdd(true)} className="btn-secondary text-sm">
            <Plus size={13}/>Add Employee
          </button>
          <button onClick={runPayroll} disabled={running||employees.length===0} className="btn-primary text-sm">
            <Play size={13}/>{running ? 'Running…' : 'Run Payroll'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Employees',   val:String(employees.length),          icon:Users,       bg:'var(--brand-dim)',   col:'var(--brand)' },
          { label:'Gross',       val:formatCurrency(totals.gross,currency), icon:DollarSign, bg:'var(--bg-table-head)', col:'var(--text-secondary)' },
          { label:'Total PAYE',  val:formatCurrency(totals.paye,currency),  icon:Calculator, bg:'var(--warning-dim)', col:'var(--warning)' },
          { label:'Net Payroll', val:formatCurrency(totals.net,currency),   icon:CheckCircle2,bg:'var(--success-dim)', col:'var(--success)' },
        ].map(s=>(
          <div key={s.label} className="card p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
              <s.icon size={14} style={{ color:s.col }}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{s.label}</p>
              <p className="font-bold text-xs sm:text-sm truncate" style={{ color:'var(--text-primary)' }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Employees */}
      {employees.length > 0 && (
        <div className="card">
          <div className="px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
            <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Active Employees</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Name</th><th className="hidden sm:table-cell">Emp #</th><th className="hidden md:table-cell">Department</th><th className="text-right">Gross Salary</th></tr></thead>
              <tbody>
                {employees.map(e=>(
                  <tr key={e.id}>
                    <td className="font-medium text-sm">{e.contact?.name}</td>
                    <td className="font-mono text-xs hidden sm:table-cell" style={{ color:'var(--brand)' }}>{e.employee_number}</td>
                    <td className="text-xs hidden md:table-cell" style={{ color:'var(--text-secondary)' }}>{e.department||'—'}</td>
                    <td className="text-right font-mono text-sm font-bold">{formatCurrency(e.gross_salary,currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 flex justify-center">
          <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background:'var(--brand)', animationDelay:`${i*0.15}s` }}/>)}</div>
        </div>
      ) : employees.length === 0 ? (
        <div className="card p-10 flex flex-col items-center text-center gap-3" style={{ color:'var(--text-muted)' }}>
          <UserX size={32} style={{ opacity:0.4 }}/>
          <div>
            <p className="font-semibold text-sm" style={{ color:'var(--text-secondary)' }}>No employees yet</p>
            <p className="text-xs mt-1">Click "Add Employee" to get started</p>
          </div>
          <button onClick={()=>setShowAdd(true)} className="btn-primary mt-2"><Plus size={15}/>Add First Employee</button>
        </div>
      ) : payrollLines.length > 0 && (
        <div className="card">
          <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderBottom:'1px solid var(--border)' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>
                Latest Payroll — {currentRun?.status === 'processed' ? 'Processed ✓' : 'Draft'}
              </h3>
              {currentRun?.status === 'processed' && (
                <p className="text-xs mt-0.5" style={{ color:'var(--success)' }}>
                  Journal entry auto-created · Tax obligations recorded
                </p>
              )}
            </div>
            {currentRun?.status === 'draft' && (
              <div className="flex items-center gap-2 text-xs p-2 rounded-xl"
                style={{ background:'var(--warning-dim)', border:'1px solid var(--warning)40' }}>
                <AlertTriangle size={13} style={{ color:'var(--warning)' }}/>
                <span style={{ color:'var(--warning)' }}>
                  Approving will auto-create a journal entry and tax records
                </span>
              </div>
            )}
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th className="text-right">Gross</th>
                  <th className="text-right">PAYE</th>
                  <th className="text-right hidden sm:table-cell">NHIF</th>
                  <th className="text-right hidden sm:table-cell">NSSF</th>
                  <th className="text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {payrollLines.map((l:any)=>(
                  <tr key={l.id}>
                    <td className="font-medium text-sm">{l.employee?.contact?.name||'Unknown'}</td>
                    <td className="text-right font-mono text-xs">{formatCurrency(l.gross_pay,currency)}</td>
                    <td className="text-right font-mono text-xs" style={{ color:'var(--warning)' }}>({formatCurrency(l.paye,currency)})</td>
                    <td className="text-right font-mono text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>({formatCurrency(l.nhif,currency)})</td>
                    <td className="text-right font-mono text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>({formatCurrency(l.nssf,currency)})</td>
                    <td className="text-right font-mono text-sm font-bold" style={{ color:'var(--success)' }}>{formatCurrency(l.net_pay,currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ background:'var(--bg-table-head)' }}>
                <tr>
                  <td className="px-4 py-3 font-semibold text-sm">Totals</td>
                  <td className="text-right px-4 py-3 font-mono text-sm font-semibold">{formatCurrency(totals.gross,currency)}</td>
                  <td className="text-right px-4 py-3 font-mono text-xs" style={{ color:'var(--warning)' }}>({formatCurrency(totals.paye,currency)})</td>
                  <td className="text-right px-4 py-3 font-mono text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>({formatCurrency(totals.nhif,currency)})</td>
                  <td className="text-right px-4 py-3 font-mono text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>({formatCurrency(totals.nssf,currency)})</td>
                  <td className="text-right px-4 py-3 font-mono text-sm font-bold" style={{ color:'var(--success)' }}>{formatCurrency(totals.net,currency)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {currentRun?.status === 'draft' && (
            <div className="flex flex-col sm:flex-row justify-end gap-2 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary text-sm flex items-center gap-2 justify-center"
                onClick={() => exportPayslips(payrollLines, currentRun?.period, organization?.name||'', currency)}>
                Export Payslips
              </button>
              <button className="btn-primary text-sm justify-center" onClick={approvePayroll} disabled={processing}>
                {processing
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Processing…</>
                  : <><BookOpen size={15}/>Approve & Process → Auto Journal Entry</>}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Employee Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>Add Employee</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowAdd(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="input-label">Full Name *</label><input className="input" placeholder="Jane Mwangi" value={empForm.full_name} onChange={e=>upd('full_name',e.target.value)}/></div>
                <div><label className="input-label">Employee Number *</label><input className="input" placeholder="EMP-001" value={empForm.employee_number} onChange={e=>upd('employee_number',e.target.value)}/></div>
                <div><label className="input-label">Email</label><input className="input" type="email" value={empForm.email} onChange={e=>upd('email',e.target.value)}/></div>
                <div><label className="input-label">Phone</label><input className="input" value={empForm.phone} onChange={e=>upd('phone',e.target.value)}/></div>
                <div><label className="input-label">Department</label><input className="input" value={empForm.department} onChange={e=>upd('department',e.target.value)}/></div>
                <div><label className="input-label">Job Title</label><input className="input" value={empForm.job_title} onChange={e=>upd('job_title',e.target.value)}/></div>
                <div><label className="input-label">Employment Type</label>
                  <select className="input" value={empForm.employment_type} onChange={e=>upd('employment_type',e.target.value)}>
                    <option value="full_time">Full Time</option><option value="part_time">Part Time</option>
                    <option value="contract">Contract</option><option value="casual">Casual</option>
                  </select></div>
                <div><label className="input-label">Hire Date</label><input className="input" type="date" value={empForm.hire_date} onChange={e=>upd('hire_date',e.target.value)}/></div>
                <div className="sm:col-span-2"><label className="input-label">Gross Monthly Salary (KES) *</label>
                  <input className="input" type="number" placeholder="50000" value={empForm.gross_salary} onChange={e=>upd('gross_salary',e.target.value)}/></div>
                <div><label className="input-label">KRA PIN</label><input className="input" placeholder="A000000000X" value={empForm.tax_pin} onChange={e=>upd('tax_pin',e.target.value)}/></div>
                <div><label className="input-label">NHIF Number</label><input className="input" value={empForm.nhif_number} onChange={e=>upd('nhif_number',e.target.value)}/></div>
              </div>
              {empForm.gross_salary && (
                <div className="rounded-xl p-3" style={{ background:'var(--bg-table-head)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color:'var(--text-primary)' }}>Tax Preview</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label:'Gross', val:Number(empForm.gross_salary) },
                      { label:'PAYE',  val:computePAYE(Number(empForm.gross_salary)) },
                      { label:'NHIF',  val:computeNHIF(Number(empForm.gross_salary)) },
                      { label:'Net',   val:Number(empForm.gross_salary)-computePAYE(Number(empForm.gross_salary))-computeNHIF(Number(empForm.gross_salary))-computeNSSF(Number(empForm.gross_salary)) },
                    ].map(item=>(
                      <div key={item.label} className="rounded-lg p-2" style={{ background:'var(--bg-card)' }}>
                        <p className="text-xs" style={{ color:'var(--text-muted)' }}>{item.label}</p>
                        <p className="font-bold text-xs mt-1" style={{ color:'var(--text-primary)' }}>{formatCurrency(item.val,currency)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary flex-1" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={saveEmployee} disabled={savingEmp}>
                <CheckCircle2 size={15}/>{savingEmp?'Saving…':'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
