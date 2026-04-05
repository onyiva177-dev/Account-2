'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { FileText, Download, Play, TrendingUp, BarChart2, DollarSign, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'

const REPORTS = [
  { id: 'income', name: 'Income Statement', icon: TrendingUp, desc: 'Profit & Loss from your accounts', color: 'text-green-600 bg-green-50' },
  { id: 'balance', name: 'Balance Sheet', icon: BarChart2, desc: 'Statement of financial position', color: 'text-blue-600 bg-blue-50' },
  { id: 'trial', name: 'Trial Balance', icon: FileText, desc: 'All account balances', color: 'text-slate-600 bg-slate-100' },
  { id: 'cashflow', name: 'Cash Flow', icon: Activity, desc: 'Operating, investing & financing', color: 'text-purple-600 bg-purple-50' },
  { id: 'ar', name: 'Aged Receivables', icon: DollarSign, desc: 'Outstanding invoices by age', color: 'text-amber-600 bg-amber-50' },
  { id: 'ap', name: 'Aged Payables', icon: DollarSign, desc: 'Outstanding bills by age', color: 'text-red-600 bg-red-50' },
  { id: 'vat', name: 'VAT Report', icon: FileText, desc: 'VAT input/output for KRA', color: 'text-brand-600 bg-brand-50' },
  { id: 'payroll', name: 'Payroll Summary', icon: FileText, desc: 'Employee payroll summary', color: 'text-teal-600 bg-teal-50' },
]

export default function ReportsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => {
    if (!organization) return
    loadAccounts()
  }, [organization])

  const loadAccounts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('accounts')
      .select('*, account_type:account_types(category, normal_balance)')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
      .order('code')
    setAccounts(data || [])
    setLoading(false)
  }

  // ─── FIXED: Account balance helper functions ──────────────────────────────
  // DB stores: balance = SUM(debit) - SUM(credit) across all journal_lines
  // Debit-normal (assets, expenses): positive balance = Dr side of TB
  // Credit-normal (liabilities, equity, revenue): negative balance = Cr side of TB

  const getDebitBalance = (a: any): number => {
    if (a.account_type?.normal_balance === 'debit' && a.balance > 0) return a.balance
    if (a.account_type?.normal_balance !== 'debit' && a.balance > 0) return a.balance // abnormal
    return 0
  }

  const getCreditBalance = (a: any): number => {
    if (a.account_type?.normal_balance === 'credit' && a.balance < 0) return Math.abs(a.balance)
    if (a.account_type?.normal_balance === 'debit' && a.balance < 0) return Math.abs(a.balance) // abnormal
    return 0
  }

  // Get display value (always positive for presentation)
  const getDisplayBalance = (a: any): number => {
    if (a.account_type?.normal_balance === 'debit') return a.balance   // positive = normal
    return Math.abs(a.balance)                                          // credit-normal stored as negative
  }

  const byCategory = (category: string) =>
    accounts.filter(a => a.account_type?.category === category && a.balance !== 0)

  const revenue = byCategory('revenue')
  const cogs = accounts.filter(a => a.account_type?.category === 'expense' && a.code?.startsWith('5') && a.balance !== 0)
  const expenses = accounts.filter(a => a.account_type?.category === 'expense' && !a.code?.startsWith('5') && a.balance !== 0)
  const assets = byCategory('asset')
  const liabilities = byCategory('liability')
  const equity = byCategory('equity')

  // Revenue and expenses use Math.abs because credit-normal revenue is stored negative
  const totalRevenue = revenue.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
  const totalCOGS = cogs.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
  const grossProfit = totalRevenue - totalCOGS
  const totalExpenses = expenses.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
  const netProfit = grossProfit - totalExpenses

  // Assets: debit-normal, stored as positive
  const totalAssets = assets.reduce((s: number, a: any) => s + a.balance, 0)
  // Liabilities & Equity: credit-normal, stored as negative → use Math.abs
  const totalLiabilities = liabilities.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
  const totalEquity = equity.reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
  // ─── FIXED: Include current period net profit in equity for balance check ──
  const totalEquityWithRetained = totalEquity + netProfit
  const balanceSheetBalances = Math.abs(totalAssets - (totalLiabilities + totalEquityWithRetained)) < 1

  // Trial balance totals (FIXED)
  const tbAccounts = accounts.filter(a => a.balance !== 0)
  const totalTBDebit = tbAccounts.reduce((s: number, a: any) => s + getDebitBalance(a), 0)
  const totalTBCredit = tbAccounts.reduce((s: number, a: any) => s + getCreditBalance(a), 0)
  const tbBalanced = Math.abs(totalTBDebit - totalTBCredit) < 1

  const ReportRow = ({ label, value, indent = false, bold = false, color = '' }: any) => (
    <div className={`flex justify-between text-sm py-1.5 ${bold ? 'font-bold text-base border-t border-slate-200 mt-1 pt-2' : ''}`}>
      <span className={`${indent ? 'pl-6' : ''} ${bold ? 'text-slate-900' : 'text-slate-700'}`}>{label}</span>
      <span className={`font-mono ${color || (bold ? 'text-slate-900' : '')}`}>{value}</span>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live data from your chart of accounts</p>
        </div>
        <input type="month" className="input w-auto" value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      {!activeReport ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className="card p-5 text-left hover:ring-2 hover:ring-brand-500 transition-all group">
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

          {loading ? (
            <div className="card p-10 flex justify-center">
              <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
            </div>

          ) : activeReport === 'income' ? (
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Income Statement</p>
                <p className="text-xs text-slate-400">As of {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              {totalRevenue === 0 && totalExpenses === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No account balances yet. Post journal entries to populate this report.</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Revenue</p>
                  {revenue.length === 0 ? <p className="text-xs text-slate-400 pl-6">No revenue accounts with balances</p> :
                    revenue.map(a => <ReportRow key={a.id} label={a.name} value={formatCurrency(Math.abs(a.balance), currency)} indent />)}
                  <ReportRow label="Total Revenue" value={formatCurrency(totalRevenue, currency)} bold />

                  {cogs.length > 0 && <>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Cost of Sales</p>
                    {cogs.map(a => <ReportRow key={a.id} label={a.name} value={`(${formatCurrency(Math.abs(a.balance), currency)})`} indent />)}
                    <ReportRow label="Gross Profit" value={formatCurrency(grossProfit, currency)} bold color={grossProfit >= 0 ? 'text-success-600' : 'text-danger-500'} />
                  </>}

                  {expenses.length > 0 && <>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Operating Expenses</p>
                    {expenses.map(a => <ReportRow key={a.id} label={a.name} value={`(${formatCurrency(Math.abs(a.balance), currency)})`} indent />)}
                    <ReportRow label="Total Expenses" value={`(${formatCurrency(totalExpenses, currency)})`} bold />
                  </>}

                  <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-lg mt-2">
                    <span>Net Profit</span>
                    <span className={`font-mono ${netProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                      {netProfit < 0 ? `-${formatCurrency(Math.abs(netProfit), currency)}` : formatCurrency(netProfit, currency)}
                    </span>
                  </div>
                  {totalRevenue > 0 && <p className="text-right text-xs text-slate-500">Net margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%</p>}
                </div>
              )}
            </div>

          ) : activeReport === 'balance' ? (
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Balance Sheet</p>
                <p className="text-xs text-slate-400">As of {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {/* Balance check banner */}
              {(assets.length > 0 || equity.length > 0) && (
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 ${balanceSheetBalances ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {balanceSheetBalances
                    ? <><CheckCircle2 size={13} /> Balance sheet balances correctly</>
                    : <><AlertTriangle size={13} /> Balance sheet does not balance — run SUPABASE_FIX.sql to recalculate account balances</>
                  }
                </div>
              )}

              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assets</p>
                {assets.length === 0 ? <p className="text-xs text-slate-400 pl-6">No asset balances</p> :
                  assets.map(a => <ReportRow key={a.id} label={a.name} value={formatCurrency(a.balance, currency)} indent />)}
                <ReportRow label="Total Assets" value={formatCurrency(totalAssets, currency)} bold />

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Liabilities</p>
                {liabilities.length === 0 ? <p className="text-xs text-slate-400 pl-6">No liability balances</p> :
                  liabilities.map(a => <ReportRow key={a.id} label={a.name} value={formatCurrency(Math.abs(a.balance), currency)} indent />)}
                <ReportRow label="Total Liabilities" value={formatCurrency(totalLiabilities, currency)} bold />

                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Equity</p>
                {equity.length === 0 ? <p className="text-xs text-slate-400 pl-6">No equity balances</p> :
                  equity.map(a => <ReportRow key={a.id} label={a.name} value={formatCurrency(Math.abs(a.balance), currency)} indent />)}

                {/* ─── FIXED: Add current period net profit to equity ─────── */}
                {(totalRevenue > 0 || totalExpenses > 0) && (
                  <ReportRow
                    label="Current Year Profit / (Loss)"
                    value={netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}
                    indent
                    color={netProfit >= 0 ? 'text-success-600' : 'text-danger-500'}
                  />
                )}

                <ReportRow label="Total Equity" value={formatCurrency(totalEquityWithRetained, currency)} bold />

                <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-lg mt-2">
                  <span>Liabilities + Equity</span>
                  <span className={`font-mono ${balanceSheetBalances ? 'text-success-600' : 'text-danger-500'}`}>
                    {formatCurrency(totalLiabilities + totalEquityWithRetained, currency)}
                  </span>
                </div>
              </div>
            </div>

          ) : activeReport === 'trial' ? (
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Trial Balance</p>
                <p className="text-xs text-slate-400">As of {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {!tbBalanced && tbAccounts.length > 0 && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700">
                  <AlertTriangle size={13} />
                  Out of balance by {formatCurrency(Math.abs(totalTBDebit - totalTBCredit), currency)} — run SUPABASE_FIX.sql
                </div>
              )}

              <table className="table border border-slate-200 rounded-xl overflow-hidden w-full">
                <thead><tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {tbAccounts.map(a => {
                    const dr = getDebitBalance(a)
                    const cr = getCreditBalance(a)
                    return (
                      <tr key={a.id}>
                        <td className="font-mono text-xs text-brand-600">{a.code}</td>
                        <td className="text-sm">{a.name}</td>
                        {/* ─── FIXED: was `a.balance > 0` for credit accounts — wrong ─── */}
                        <td className="text-right font-mono text-sm">
                          {dr > 0 ? formatCurrency(dr, currency) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="text-right font-mono text-sm">
                          {cr > 0 ? formatCurrency(cr, currency) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">Totals</td>
                    {/* ─── FIXED: credit total was using wrong filter ─── */}
                    <td className="text-right px-4 py-3 font-mono">{formatCurrency(totalTBDebit, currency)}</td>
                    <td className={`text-right px-4 py-3 font-mono ${tbBalanced ? 'text-success-600' : 'text-danger-500'}`}>
                      {formatCurrency(totalTBCredit, currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          ) : (
            <div className="card p-10 max-w-xl flex flex-col items-center text-center gap-3 text-slate-400">
              <FileText size={36} className="opacity-40" />
              <p className="font-medium text-slate-700">Coming soon</p>
              <p className="text-sm">This report will be generated from your live transaction data</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
