'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Play, Users, DollarSign, Calculator, CheckCircle2 } from 'lucide-react'

const MOCK_EMPLOYEES = [
  { id: '1', name: 'Jane Mwangi', role: 'Finance Manager', gross: 180000, paye: 42780, nhif: 1700, nssf: 2160, net: 133360 },
  { id: '2', name: 'John Otieno', role: 'Accountant', gross: 120000, paye: 24780, nhif: 1700, nssf: 1440, net: 92080 },
  { id: '3', name: 'Mary Njoroge', role: 'Sales Rep', gross: 90000, paye: 16280, nhif: 1700, nssf: 1080, net: 70940 },
  { id: '4', name: 'Peter Kamau', role: 'IT Officer', gross: 110000, paye: 21780, nhif: 1700, nssf: 1320, net: 85200 },
  { id: '5', name: 'Sarah Wanjiru', role: 'Receptionist', gross: 65000, paye: 9280, nhif: 1700, nssf: 780, net: 53240 },
]

export default function PayrollPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [showRun, setShowRun] = useState(false)

  const totals = MOCK_EMPLOYEES.reduce((acc, e) => ({
    gross: acc.gross + e.gross,
    paye: acc.paye + e.paye,
    nhif: acc.nhif + e.nhif,
    nssf: acc.nssf + e.nssf,
    net: acc.net + e.net,
  }), { gross: 0, paye: 0, nhif: 0, nssf: 0, net: 0 })

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payroll</h1>
          <p className="text-sm text-slate-500 mt-0.5">Employee salaries, PAYE, NHIF & NSSF</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Plus size={15} />Add Employee</button>
          <button onClick={() => setShowRun(true)} className="btn-primary"><Play size={15} />Run Payroll</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Employees', value: MOCK_EMPLOYEES.length, icon: Users, raw: true, color: 'text-brand-600 bg-brand-50' },
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
              <p className="font-bold text-slate-900 text-sm">{(s as any).raw ? s.value : formatCurrency(s.value as number, currency)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">February 2026 Payroll</h3>
          <p className="text-xs text-slate-500 mt-0.5">Draft — Pending Approval</p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th><th>Role</th>
              <th className="text-right">Gross Pay</th>
              <th className="text-right">PAYE</th>
              <th className="text-right">NHIF</th>
              <th className="text-right">NSSF</th>
              <th className="text-right">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_EMPLOYEES.map(e => (
              <tr key={e.id}>
                <td className="font-medium text-slate-800">{e.name}</td>
                <td className="text-slate-500 text-xs">{e.role}</td>
                <td className="text-right font-mono text-sm">{formatCurrency(e.gross, currency)}</td>
                <td className="text-right font-mono text-sm text-amber-600">({formatCurrency(e.paye, currency)})</td>
                <td className="text-right font-mono text-sm text-slate-500">({formatCurrency(e.nhif, currency)})</td>
                <td className="text-right font-mono text-sm text-slate-500">({formatCurrency(e.nssf, currency)})</td>
                <td className="text-right font-mono text-sm font-bold text-success-600">{formatCurrency(e.net, currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-sm">
            <tr>
              <td colSpan={2} className="px-4 py-3">Totals</td>
              <td className="text-right px-4 py-3 font-mono">{formatCurrency(totals.gross, currency)}</td>
              <td className="text-right px-4 py-3 font-mono text-amber-600">({formatCurrency(totals.paye, currency)})</td>
              <td className="text-right px-4 py-3 font-mono text-slate-500">({formatCurrency(totals.nhif, currency)})</td>
              <td className="text-right px-4 py-3 font-mono text-slate-500">({formatCurrency(totals.nssf, currency)})</td>
              <td className="text-right px-4 py-3 font-mono text-success-600">{formatCurrency(totals.net, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn-secondary">Export Payslips</button>
        <button className="btn-primary"><CheckCircle2 size={15} />Approve & Process</button>
      </div>
    </div>
  )
}
