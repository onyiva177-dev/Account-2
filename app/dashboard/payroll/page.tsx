'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Play, Users, DollarSign, Calculator, CheckCircle2, UserX } from 'lucide-react'
import toast from 'react-hot-toast'

export default function PayrollPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [employees, setEmployees] = useState<any[]>([])
  const [payrollLines, setPayrollLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: emps } = await supabase
      .from('employees')
      .select('*, contact:contacts(name, email)')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
    setEmployees(emps || [])

    const { data: run } = await supabase
      .from('payroll_runs')
      .select('*, payroll_lines(*, employee:employees(*, contact:contacts(name)))')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (run?.payroll_lines) setPayrollLines(run.payroll_lines)
    setLoading(false)
  }

  const computePAYE = (gross: number) => {
    let tax = 0
    if (gross <= 24000) tax = gross * 0.10
    else if (gross <= 32333) tax = 2400 + (gross - 24000) * 0.25
    else if (gross <= 500000) tax = 4483.25 + (gross - 32333) * 0.30
    else tax = 4483.25 + 140300 + (gross - 500000) * 0.325
    return Math.max(0, Math.round(tax - 2400))
  }

  const computeNHIF = (gross: number) => {
    if (gross < 6000) return 150
    if (gross < 8000) return 300
    if (gross < 12000) return 400
    if (gross < 15000) return 500
    if (gross < 20000) return 600
    if (gross < 25000) return 750
    if (gross < 30000) return 850
    if (gross < 35000) return 900
    if (gross < 40000) return 950
    if (gross < 45000) return 1000
    if (gross < 50000) return 1100
    if (gross < 60000) return 1200
    if (gross < 70000) return 1300
    if (gross < 80000) return 1400
    if (gross < 90000) return 1500
    if (gross < 100000) return 1600
    return 1700
  }

  const computeNSSF = (gross: number) => {
    const tier1 = Math.min(gross, 6000) * 0.06
    const tier2 = Math.min(Math.max(gross - 6000, 0), 12000) * 0.06
    return Math.round(tier1 + tier2)
  }

  const runPayroll = async () => {
    if (employees.length === 0) { toast.error('No active employees found'); return }
    setRunning(true)
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const lines = employees.map(e => {
      const gross = e.gross_salary
      const paye = computePAYE(gross)
      const nhif = computeNHIF(gross)
      const nssf = computeNSSF(gross)
      return { employee_id: e.id, gross_pay: gross, basic_pay: gross, paye, nhif, nssf, net_pay: gross - paye - nhif - nssf }
    })

    const totals = lines.reduce((acc, l) => ({
      gross: acc.gross + l.gross_pay, paye: acc.paye + l.paye,
      nhif: acc.nhif + l.nhif, nssf: acc.nssf + l.nssf, net: acc.net + l.net_pay,
    }), { gross: 0, paye: 0, nhif: 0, nssf: 0, net: 0 })

    const { data: run, error } = await supabase.from('payroll_runs').insert({
      organization_id: organization!.id, period, start_date: startDate, end_date: endDate,
      status: 'draft', total_gross: totals.gross, total_paye: totals.paye,
      total_nhif: totals.nhif, total_nssf: totals.nssf, total_net: totals.net,
    }).select().single()

    if (error) { toast.error('Failed to create payroll run'); setRunning(false); return }
    await supabase.from('payroll_lines').insert(lines.map(l => ({ ...l, payroll_run_id: run.id })))
    toast.success(`Payroll run created for ${period}`)
    setRunning(false)
    load()
  }

  const totals = payrollLines.reduce((acc, l) => ({
    gross: acc.gross + l.gross_pay, paye: acc.paye + l.paye,
    nhif: acc.nhif + l.nhif, nssf: acc.nssf + l.nssf, net: acc.net + l.net_pay,
  }), { gross: 0, paye: 0, nhif: 0, nssf: 0, net: 0 })

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kenya PAYE, NHIF & NSSF auto-calculated</p>
        </div>
        <button onClick={runPayroll} disabled={running || employees.length === 0} className="btn-primary">
          <Play size={15} />{running ? 'Running...' : 'Run Payroll'}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Employees', value: employees.length, icon: Users, raw: true, color: 'text-brand-600 bg-brand-50' },
          { label: 'Gross Payroll', value: totals.gross, icon: DollarSign, color: 'text-slate-600 bg-slate-100' },
          { label: 'Total PAYE', value: totals.paye, icon: Calculator, color: 'text-amber-600 bg-amber-50' },
          { label: 'Net Payroll', value: totals.net, icon: CheckCircle2, color: 'text-success-600 bg-green-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="font-bold text-slate-900 text-sm">
                {(s as any).raw ? s.value : formatCurrency(s.value as number, currency)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 flex items-center justify-center">
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        </div>
      ) : employees.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3 text-slate-400">
          <UserX size={36} className="opacity-40" />
          <div>
            <p className="font-medium text-slate-700">No employees found</p>
            <p className="text-sm mt-1">Add employees in the <code className="bg-slate-100 px-1 rounded">employees</code> table in Supabase with their gross salary.</p>
          </div>
        </div>
      ) : payrollLines.length === 0 ? (
        <div className="card p-8 flex flex-col items-center text-center gap-3 text-slate-400">
          <Play size={36} className="opacity-40" />
          <p className="font-medium text-slate-700">{employees.length} employee{employees.length !== 1 ? 's' : ''} ready</p>
          <p className="text-sm">Click "Run Payroll" to calculate salaries</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Latest Payroll Run — Draft</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="text-right">Gross</th>
                <th className="text-right">PAYE</th>
                <th className="text-right">NHIF</th>
                <th className="text-right">NSSF</th>
                <th className="text-right">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              {payrollLines.map((l: any) => (
                <tr key={l.id}>
                  <td className="font-medium text-slate-800">{l.employee?.contact?.name || 'Unknown'}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(l.gross_pay, currency)}</td>
                  <td className="text-right font-mono text-sm text-amber-600">({formatCurrency(l.paye, currency)})</td>
                  <td className="text-right font-mono text-sm text-slate-500">({formatCurrency(l.nhif, currency)})</td>
                  <td className="text-right font-mono text-sm text-slate-500">({formatCurrency(l.nssf, currency)})</td>
                  <td className="text-right font-mono text-sm font-bold text-success-600">{formatCurrency(l.net_pay, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-sm">
              <tr>
                <td className="px-4 py-3">Totals</td>
                <td className="text-right px-4 py-3 font-mono">{formatCurrency(totals.gross, currency)}</td>
                <td className="text-right px-4 py-3 font-mono text-amber-600">({formatCurrency(totals.paye, currency)})</td>
                <td className="text-right px-4 py-3 font-mono text-slate-500">({formatCurrency(totals.nhif, currency)})</td>
                <td className="text-right px-4 py-3 font-mono text-slate-500">({formatCurrency(totals.nssf, currency)})</td>
                <td className="text-right px-4 py-3 font-mono text-success-600">{formatCurrency(totals.net, currency)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="flex justify-end gap-3 p-4 border-t border-slate-100">
            <button className="btn-secondary">Export Payslips</button>
            <button className="btn-primary">
              <CheckCircle2 size={15} />Approve & Process
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
