'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { FileText, Download, Play, TrendingUp, BarChart2, DollarSign, Activity } from 'lucide-react'

const REPORTS = [
  { id: 'income', name: 'Income Statement', icon: TrendingUp, desc: 'Profit & Loss for selected period', color: 'text-green-600 bg-green-50', available: true },
  { id: 'balance', name: 'Balance Sheet', icon: BarChart2, desc: 'Statement of financial position', color: 'text-blue-600 bg-blue-50', available: true },
  { id: 'cashflow', name: 'Cash Flow Statement', icon: Activity, desc: 'Operating, investing & financing', color: 'text-purple-600 bg-purple-50', available: true },
  { id: 'trial', name: 'Trial Balance', icon: FileText, desc: 'All account balances', color: 'text-slate-600 bg-slate-100', available: true },
  { id: 'ar', name: 'Aged Receivables', icon: DollarSign, desc: 'Outstanding invoices by age', color: 'text-amber-600 bg-amber-50', available: true },
  { id: 'ap', name: 'Aged Payables', icon: DollarSign, desc: 'Outstanding bills by age', color: 'text-red-600 bg-red-50', available: true },
  { id: 'vat', name: 'VAT Report', icon: FileText, desc: 'VAT input/output for KRA', color: 'text-brand-600 bg-brand-50', available: true },
  { id: 'payroll', name: 'Payroll Summary', icon: FileText, desc: 'Employee payroll summary', color: 'text-teal-600 bg-teal-50', available: true },
]

// Mock Income Statement data
const IS_DATA = {
  revenue: { 'Sales Revenue': 720000, 'Service Revenue': 180000, 'Other Income': 24000 },
  cogs: { 'Cost of Goods Sold': 280000 },
  expenses: { 'Salaries': 180000, 'Rent': 60000, 'Utilities': 28000, 'Marketing': 42000, 'Other': 32000 },
}

export default function ReportsPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [period, setPeriod] = useState('2026-02')

  const totalRevenue = Object.values(IS_DATA.revenue).reduce((a, b) => a + b, 0)
  const totalCOGS = Object.values(IS_DATA.cogs).reduce((a, b) => a + b, 0)
  const grossProfit = totalRevenue - totalCOGS
  const totalExpenses = Object.values(IS_DATA.expenses).reduce((a, b) => a + b, 0)
  const netProfit = grossProfit - totalExpenses

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Generate and export reports</p>
        </div>
        <div className="flex gap-2">
          <input type="month" className="input w-auto" value={period} onChange={e => setPeriod(e.target.value)} />
        </div>
      </div>

      {!activeReport ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {REPORTS.map(r => (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id)}
              className="card p-5 text-left hover:ring-2 hover:ring-brand-500 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${r.color}`}>
                <r.icon size={18} />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{r.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={11} />Generate
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <button onClick={() => setActiveReport(null)} className="btn-ghost">← Back</button>
            <h2 className="font-semibold text-slate-900">{REPORTS.find(r => r.id === activeReport)?.name}</h2>
            <button className="btn-secondary ml-auto"><Download size={15} />Export PDF</button>
            <button className="btn-secondary"><Download size={15} />Export Excel</button>
          </div>

          {activeReport === 'income' && (
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Income Statement</p>
                <p className="text-xs text-slate-400">For the month ended February 28, 2026</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Revenue</p>
                {Object.entries(IS_DATA.revenue).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1">
                    <span className="text-slate-700 pl-4">{k}</span>
                    <span className="font-mono">{formatCurrency(v, currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-200 font-semibold">
                  <span className="text-slate-900">Total Revenue</span>
                  <span className="font-mono text-slate-900">{formatCurrency(totalRevenue, currency)}</span>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Cost of Sales</p>
                {Object.entries(IS_DATA.cogs).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1">
                    <span className="text-slate-700 pl-4">{k}</span>
                    <span className="font-mono">({formatCurrency(v, currency)})</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-200 font-bold text-lg mt-1">
                  <span className="text-slate-900">Gross Profit</span>
                  <span className="font-mono text-success-600">{formatCurrency(grossProfit, currency)}</span>
                </div>

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Operating Expenses</p>
                {Object.entries(IS_DATA.expenses).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1">
                    <span className="text-slate-700 pl-4">{k}</span>
                    <span className="font-mono">({formatCurrency(v, currency)})</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm py-2 border-t border-slate-200 font-semibold">
                  <span className="text-slate-900">Total Expenses</span>
                  <span className="font-mono">({formatCurrency(totalExpenses, currency)})</span>
                </div>

                <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-lg">
                  <span className="text-slate-900">Net Profit</span>
                  <span className={`font-mono ${netProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                    {formatCurrency(netProfit, currency)}
                  </span>
                </div>
                <p className="text-right text-xs text-slate-500">
                  Net margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {activeReport !== 'income' && (
            <div className="card p-10 max-w-xl flex flex-col items-center text-center gap-3 text-slate-400">
              <FileText size={36} className="opacity-40" />
              <p className="font-medium text-slate-700">Report will be generated from your transaction data</p>
              <p className="text-sm">Connect your accounts and post journal entries to see this report populate automatically</p>
              <button className="btn-primary mt-2"><Play size={15} />Generate Now</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
