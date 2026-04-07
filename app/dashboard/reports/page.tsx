'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import {
  FileText, Download, Play, TrendingUp, BarChart2, DollarSign,
  Activity, AlertTriangle, CheckCircle2, ChevronLeft, Printer,
  RefreshCw, BookOpen, Scale
} from 'lucide-react'

const REPORTS = [
  { id: 'income',  name: 'Income Statement',  icon: TrendingUp, desc: 'Profit & Loss account', color: 'text-green-600 bg-green-50' },
  { id: 'trading', name: 'Trading Account',   icon: BookOpen,   desc: 'Gross profit calculation', color: 'text-teal-600 bg-teal-50' },
  { id: 'final',   name: 'Final Accounts',    icon: Scale,      desc: 'Trading → P&L → Balance Sheet', color: 'text-purple-600 bg-purple-50' },
  { id: 'balance', name: 'Balance Sheet',     icon: BarChart2,  desc: 'Statement of financial position', color: 'text-blue-600 bg-blue-50' },
  { id: 'trial',   name: 'Trial Balance',     icon: FileText,   desc: 'All account balances', color: 'text-slate-600 bg-slate-100' },
  { id: 'cashflow',name: 'Cash Flow',         icon: Activity,   desc: 'Operating, investing & financing', color: 'text-indigo-600 bg-indigo-50' },
  { id: 'ar',      name: 'Aged Receivables',  icon: DollarSign, desc: 'Outstanding invoices by age', color: 'text-amber-600 bg-amber-50' },
  { id: 'ap',      name: 'Aged Payables',     icon: DollarSign, desc: 'Outstanding bills by age', color: 'text-red-600 bg-red-50' },
  { id: 'vat',     name: 'VAT Report',        icon: FileText,   desc: 'VAT input/output for KRA', color: 'text-brand-600 bg-brand-50' },
]

export default function ReportsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [accounts, setAccounts]         = useState<any[]>([])
  const [periodLines, setPeriodLines]   = useState<any[]>([])   // journal_lines for selected period
  const [loading, setLoading]           = useState(false)
  const [exporting, setExporting]       = useState(false)

  // Period: default to current month, full range
  const now = new Date()
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  )

  // ── Load full account metadata (names, types, codes) ─────────────────────
  useEffect(() => {
    if (!organization) return
    loadAccountMeta()
  }, [organization])

  const loadAccountMeta = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*, account_type:account_types(category, normal_balance)')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
      .order('code')
    setAccounts(data || [])
  }

  // ── Load journal_lines for the selected date range (REAL period filter) ───
  const loadPeriodData = useCallback(async () => {
    if (!organization) return
    setLoading(true)

    const { data } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit, journal_entry:journal_entries!inner(date, status, organization_id)')
      .eq('journal_entry.organization_id', organization.id)
      .eq('journal_entry.status', 'posted')
      .gte('journal_entry.date', startDate)
      .lte('journal_entry.date', endDate)

    setPeriodLines(data || [])
    setLoading(false)
  }, [organization, startDate, endDate])

  useEffect(() => {
    if (activeReport) loadPeriodData()
  }, [activeReport, startDate, endDate])

  // ── Derive per-account balances from the filtered lines ──────────────────
  // balance = SUM(debit) - SUM(credit) for lines in period
  const periodBalances = periodLines.reduce((acc: Record<string, number>, line) => {
    acc[line.account_id] = (acc[line.account_id] || 0) + line.debit - line.credit
    return acc
  }, {})

  // Enrich accounts with period balance
  const accountsWithPeriodBalance = accounts.map(a => ({
    ...a,
    periodBalance: periodBalances[a.id] || 0,
  }))

  const byCategory = (category: string) =>
    accountsWithPeriodBalance.filter(a => a.account_type?.category === category && a.periodBalance !== 0)

  const getDisplay = (a: any): number => {
    if (a.account_type?.normal_balance === 'debit') return a.periodBalance
    return Math.abs(a.periodBalance)
  }

  // Revenue & expenses
  const revenueAccounts  = byCategory('revenue')
  const totalRevenue     = revenueAccounts.reduce((s, a) => s + Math.abs(a.periodBalance), 0)

  // Purchases / COGS = expense accounts starting with 5xxx
  const purchaseAccounts = accountsWithPeriodBalance.filter(a =>
    a.account_type?.category === 'expense' && a.code?.startsWith('5') && a.periodBalance !== 0)
  const totalPurchases   = purchaseAccounts.reduce((s, a) => s + Math.abs(a.periodBalance), 0)
  const grossProfit      = totalRevenue - totalPurchases

  // Operating expenses = expense accounts NOT starting with 5xxx
  const expenseAccounts  = accountsWithPeriodBalance.filter(a =>
    a.account_type?.category === 'expense' && !a.code?.startsWith('5') && a.periodBalance !== 0)
  const totalExpenses    = expenseAccounts.reduce((s, a) => s + Math.abs(a.periodBalance), 0)
  const netProfit        = grossProfit - totalExpenses

  // Balance sheet
  const assetAccounts    = byCategory('asset')
  const liabAccounts     = byCategory('liability')
  const equityAccounts   = byCategory('equity')
  const totalAssets      = assetAccounts.reduce((s, a) => s + a.periodBalance, 0)
  const totalLiabilities = liabAccounts.reduce((s, a) => s + Math.abs(a.periodBalance), 0)
  const totalEquity      = equityAccounts.reduce((s, a) => s + Math.abs(a.periodBalance), 0)
  const totalEquityWithPL = totalEquity + netProfit
  const bsBalances       = Math.abs(totalAssets - (totalLiabilities + totalEquityWithPL)) < 1

  // Trial balance
  const getDebit = (a: any): number => {
    if (a.account_type?.normal_balance === 'debit'  && a.periodBalance > 0) return a.periodBalance
    if (a.account_type?.normal_balance !== 'debit'  && a.periodBalance > 0) return a.periodBalance
    return 0
  }
  const getCredit = (a: any): number => {
    if (a.account_type?.normal_balance === 'credit' && a.periodBalance < 0) return Math.abs(a.periodBalance)
    if (a.account_type?.normal_balance === 'debit'  && a.periodBalance < 0) return Math.abs(a.periodBalance)
    return 0
  }
  const tbAccounts    = accountsWithPeriodBalance.filter(a => a.periodBalance !== 0)
  const totalTBDebit  = tbAccounts.reduce((s, a) => s + getDebit(a), 0)
  const totalTBCredit = tbAccounts.reduce((s, a) => s + getCredit(a), 0)
  const tbBalanced    = Math.abs(totalTBDebit - totalTBCredit) < 1

  // ── Report row component ─────────────────────────────────────────────────
  const Row = ({ label, value, indent = false, bold = false, color = '', border = false }: any) => (
    <div className={`flex justify-between text-sm py-1.5 ${bold ? 'font-semibold' : ''} ${border ? 'border-t border-slate-200 mt-1 pt-2' : ''}`}>
      <span className={`${indent ? 'pl-6 text-slate-600' : 'text-slate-800'}`}>{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  )

  const SectionHeader = ({ label }: { label: string }) => (
    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-5 mb-2">{label}</p>
  )

  // ── EXPORT: proper CSV download ──────────────────────────────────────────
  const exportCSV = (rows: string[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── EXPORT: proper printable PDF (opens clean print window) ─────────────
  const exportPDF = (title: string, htmlContent: string) => {
    const orgName = organization?.name || 'FinAI'
    const period  = `${startDate} to ${endDate}`
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) { alert('Please allow popups for PDF export'); return }
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${title} — ${orgName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 2px; }
  .sub { color: #64748b; font-size: 11px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #f8fafc; padding: 8px 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; border-bottom: 1.5px solid #e2e8f0; }
  td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; }
  .bold { font-weight: 700; }
  .indent { padding-left: 28px; color: #475569; }
  .total-row td { border-top: 2px solid #334155; border-bottom: none; font-weight: 700; font-size: 13px; padding-top: 10px; }
  .section { background: #f8fafc; font-weight: 600; padding: 6px 12px; }
  .red { color: #dc2626; }
  .green { color: #16a34a; }
  @media print { body { padding: 16px; } }
</style></head>
<body>
<h1>${orgName}</h1>
<p class="sub">${title} &nbsp;|&nbsp; Period: ${period}</p>
${htmlContent}
<script>window.onload = () => { window.print(); }<\/script>
</body></html>`)
    win.document.close()
  }

  const handleExportCSV = () => {
    if (!activeReport) return
    const report = REPORTS.find(r => r.id === activeReport)
    const rows: string[][] = []

    if (activeReport === 'trial') {
      rows.push(['Code', 'Account', 'Debit', 'Credit'])
      tbAccounts.forEach(a => rows.push([a.code, a.name, String(getDebit(a) || ''), String(getCredit(a) || '')]))
      rows.push(['', 'TOTALS', String(totalTBDebit), String(totalTBCredit)])
    } else if (activeReport === 'income') {
      rows.push(['Section', 'Account', 'Amount'])
      rows.push(['Revenue', '', ''])
      revenueAccounts.forEach(a => rows.push(['', a.name, String(Math.abs(a.periodBalance))]))
      rows.push(['', 'Total Revenue', String(totalRevenue)])
      rows.push(['Expenses', '', ''])
      expenseAccounts.forEach(a => rows.push(['', a.name, String(Math.abs(a.periodBalance))]))
      rows.push(['', 'Total Expenses', String(totalExpenses)])
      rows.push(['', 'NET PROFIT / (LOSS)', String(netProfit)])
    } else if (activeReport === 'balance') {
      rows.push(['Section', 'Account', 'Amount'])
      rows.push(['Assets', '', ''])
      assetAccounts.forEach(a => rows.push(['', a.name, String(a.periodBalance)]))
      rows.push(['', 'Total Assets', String(totalAssets)])
      rows.push(['Liabilities', '', ''])
      liabAccounts.forEach(a => rows.push(['', a.name, String(Math.abs(a.periodBalance))]))
      rows.push(['', 'Total Liabilities', String(totalLiabilities)])
      rows.push(['Equity', '', ''])
      equityAccounts.forEach(a => rows.push(['', a.name, String(Math.abs(a.periodBalance))]))
      rows.push(['', 'Current Year P&L', String(netProfit)])
      rows.push(['', 'Total Equity', String(totalEquityWithPL)])
      rows.push(['', 'Liabilities + Equity', String(totalLiabilities + totalEquityWithPL)])
    }

    if (rows.length === 0) { alert('CSV export for this report coming soon'); return }
    exportCSV(rows, `${report?.name.replace(/ /g, '_')}_${startDate}.csv`)
  }

  const handleExportPDF = () => {
    if (!activeReport) return

    if (activeReport === 'trial') {
      const rows = tbAccounts.map(a => `
        <tr>
          <td class="indent" style="font-family:monospace">${a.code}</td>
          <td>${a.name}</td>
          <td class="right">${getDebit(a) > 0 ? formatCurrency(getDebit(a), currency) : '—'}</td>
          <td class="right">${getCredit(a) > 0 ? formatCurrency(getCredit(a), currency) : '—'}</td>
        </tr>`).join('')
      exportPDF('Trial Balance', `
        <table>
          <thead><tr><th>Code</th><th>Account</th><th class="right">Debit</th><th class="right">Credit</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr class="total-row"><td colspan="2">Totals</td><td class="right">${formatCurrency(totalTBDebit, currency)}</td><td class="right ${tbBalanced ? 'green' : 'red'}">${formatCurrency(totalTBCredit, currency)}</td></tr></tfoot>
        </table>`)
      return
    }

    if (activeReport === 'income') {
      const revRows  = revenueAccounts.map(a  => `<tr><td class="indent">${a.name}</td><td class="right">${formatCurrency(Math.abs(a.periodBalance), currency)}</td></tr>`).join('')
      const expRows  = expenseAccounts.map(a  => `<tr><td class="indent">${a.name}</td><td class="right">(${formatCurrency(Math.abs(a.periodBalance), currency)})</td></tr>`).join('')
      exportPDF('Income Statement', `
        <table>
          <thead><tr><th>Description</th><th class="right">Amount (${currency})</th></tr></thead>
          <tbody>
            <tr><td class="section" colspan="2">Revenue</td></tr>${revRows}
            <tr class="bold"><td>Total Revenue</td><td class="right">${formatCurrency(totalRevenue, currency)}</td></tr>
            <tr><td class="section" colspan="2">Operating Expenses</td></tr>${expRows}
            <tr class="bold"><td>Total Expenses</td><td class="right">(${formatCurrency(totalExpenses, currency)})</td></tr>
          </tbody>
          <tfoot><tr class="total-row"><td>Net Profit / (Loss)</td><td class="right ${netProfit >= 0 ? 'green' : 'red'}">${netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}</td></tr></tfoot>
        </table>`)
      return
    }

    if (activeReport === 'balance') {
      const assetRows  = assetAccounts.map(a  => `<tr><td class="indent">${a.name}</td><td class="right">${formatCurrency(a.periodBalance, currency)}</td></tr>`).join('')
      const liabRows   = liabAccounts.map(a   => `<tr><td class="indent">${a.name}</td><td class="right">${formatCurrency(Math.abs(a.periodBalance), currency)}</td></tr>`).join('')
      const equityRows = equityAccounts.map(a => `<tr><td class="indent">${a.name}</td><td class="right">${formatCurrency(Math.abs(a.periodBalance), currency)}</td></tr>`).join('')
      exportPDF('Balance Sheet', `
        <table>
          <thead><tr><th>Description</th><th class="right">Amount (${currency})</th></tr></thead>
          <tbody>
            <tr><td class="section" colspan="2">Assets</td></tr>${assetRows}
            <tr class="bold"><td>Total Assets</td><td class="right">${formatCurrency(totalAssets, currency)}</td></tr>
            <tr><td class="section" colspan="2">Liabilities</td></tr>${liabRows}
            <tr class="bold"><td>Total Liabilities</td><td class="right">${formatCurrency(totalLiabilities, currency)}</td></tr>
            <tr><td class="section" colspan="2">Equity</td></tr>${equityRows}
            <tr><td class="indent">Current Year Profit / (Loss)</td><td class="right ${netProfit >= 0 ? 'green' : 'red'}">${netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}</td></tr>
            <tr class="bold"><td>Total Equity</td><td class="right">${formatCurrency(totalEquityWithPL, currency)}</td></tr>
          </tbody>
          <tfoot><tr class="total-row"><td>Liabilities + Equity</td><td class="right ${bsBalances ? 'green' : 'red'}">${formatCurrency(totalLiabilities + totalEquityWithPL, currency)}</td></tr></tfoot>
        </table>`)
      return
    }

    alert('PDF export for this report coming soon')
  }

  // ── UI ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Period-filtered · Live from journal entries</p>
        </div>

        {/* ── REAL DATE RANGE FILTER ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <span className="text-slate-400 text-xs">From</span>
            <input type="date" className="text-slate-800 text-sm border-0 outline-none bg-transparent"
              value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
            <span className="text-slate-400 text-xs">To</span>
            <input type="date" className="text-slate-800 text-sm border-0 outline-none bg-transparent"
              value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          {activeReport && (
            <button onClick={loadPeriodData} className="btn-secondary">
              <RefreshCw size={14} />Apply
            </button>
          )}
        </div>
      </div>

      {/* Report grid */}
      {!activeReport ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {REPORTS.map(r => (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className="card p-5 text-left hover:ring-2 hover:ring-brand-500 transition-all group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${r.color}`}>
                <r.icon size={18} />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">{r.name}</h3>
              <p className="text-xs text-slate-500 mt-1">{r.desc}</p>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play size={11} />Generate
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <button onClick={() => setActiveReport(null)} className="btn-ghost">
              <ChevronLeft size={15} />Back
            </button>
            <h2 className="font-semibold text-slate-900">{REPORTS.find(r => r.id === activeReport)?.name}</h2>
            <span className="text-xs text-slate-400 ml-1">{startDate} → {endDate}</span>

            <div className="flex gap-2 ml-auto">
              <button onClick={handleExportCSV} className="btn-secondary text-xs">
                <Download size={13} />Excel / CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary text-xs">
                <Printer size={13} />Print / PDF
              </button>
            </div>
          </div>

          {loading ? (
            <div className="card p-10 flex justify-center">
              <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
            </div>

          ) : activeReport === 'trading' ? (
            // ── Trading Account ──────────────────────────────────────────────
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Trading Account</p>
                <p className="text-xs text-slate-400">For the period {startDate} to {endDate}</p>
              </div>
              <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden text-sm">
                {/* Dr side */}
                <div className="border-r border-slate-200 p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">Dr</p>
                  {purchaseAccounts.length === 0
                    ? <p className="text-xs text-slate-400">No purchases</p>
                    : purchaseAccounts.map(a => (
                      <div key={a.id} className="flex justify-between py-1">
                        <span className="text-slate-700">{a.name}</span>
                        <span className="font-mono">{formatCurrency(Math.abs(a.periodBalance), currency)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between py-1 mt-1 border-t border-slate-200 font-semibold">
                    <span>Gross Profit c/d</span>
                    <span className={`font-mono ${grossProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                      {formatCurrency(Math.abs(grossProfit), currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-t-2 border-slate-700 font-bold">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(totalRevenue, currency)}</span>
                  </div>
                </div>
                {/* Cr side */}
                <div className="p-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-3">Cr</p>
                  {revenueAccounts.length === 0
                    ? <p className="text-xs text-slate-400">No sales</p>
                    : revenueAccounts.map(a => (
                      <div key={a.id} className="flex justify-between py-1">
                        <span className="text-slate-700">{a.name}</span>
                        <span className="font-mono">{formatCurrency(Math.abs(a.periodBalance), currency)}</span>
                      </div>
                    ))}
                  <div className="flex justify-between py-1.5 border-t-2 border-slate-700 font-bold mt-auto">
                    <span>Total</span>
                    <span className="font-mono">{formatCurrency(totalRevenue, currency)}</span>
                  </div>
                </div>
              </div>
              <div className={`mt-4 text-center p-3 rounded-xl font-semibold ${grossProfit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {grossProfit >= 0 ? 'Gross Profit' : 'Gross Loss'}: {formatCurrency(Math.abs(grossProfit), currency)}
              </div>
            </div>

          ) : activeReport === 'income' ? (
            // ── Income Statement (P&L) ──────────────────────────────────────
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Income Statement (Profit & Loss)</p>
                <p className="text-xs text-slate-400">For the period {startDate} to {endDate}</p>
              </div>
              {totalRevenue === 0 && totalExpenses === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No transactions in this period.</p>
              ) : (
                <div>
                  <SectionHeader label="Revenue" />
                  {revenueAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(Math.abs(a.periodBalance), currency)} indent />)}
                  <Row label="Total Revenue" value={formatCurrency(totalRevenue, currency)} bold border />

                  {purchaseAccounts.length > 0 && <>
                    <SectionHeader label="Cost of Sales" />
                    {purchaseAccounts.map(a => <Row key={a.id} label={a.name} value={`(${formatCurrency(Math.abs(a.periodBalance), currency)})`} indent />)}
                    <Row label="Gross Profit" value={formatCurrency(grossProfit, currency)} bold border
                      color={grossProfit >= 0 ? 'text-success-600' : 'text-danger-500'} />
                  </>}

                  <SectionHeader label="Operating Expenses" />
                  {expenseAccounts.map(a => <Row key={a.id} label={a.name} value={`(${formatCurrency(Math.abs(a.periodBalance), currency)})`} indent />)}
                  <Row label="Total Expenses" value={`(${formatCurrency(totalExpenses, currency)})`} bold border />

                  <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-lg mt-3">
                    <span>Net Profit / (Loss)</span>
                    <span className={`font-mono ${netProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                      {netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}
                    </span>
                  </div>
                  {totalRevenue > 0 && <p className="text-right text-xs text-slate-500 mt-1">Net margin: {((netProfit / totalRevenue) * 100).toFixed(1)}%</p>}
                </div>
              )}
            </div>

          ) : activeReport === 'final' ? (
            // ── Final Accounts (Trading → P&L → Balance Sheet) ─────────────
            <div className="space-y-6 max-w-2xl">
              {/* 1. Trading Account */}
              <div className="card p-6">
                <div className="text-center mb-4">
                  <h2 className="text-base font-bold text-slate-900">{organization?.name}</h2>
                  <p className="text-sm font-semibold text-slate-700">Trading Account</p>
                  <p className="text-xs text-slate-400">For the period {startDate} to {endDate}</p>
                </div>
                <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden text-sm">
                  <div className="border-r border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Dr (Purchases Side)</p>
                    {purchaseAccounts.map(a => (
                      <div key={a.id} className="flex justify-between py-0.5">
                        <span className="text-slate-700 text-xs">{a.name}</span>
                        <span className="font-mono text-xs">{formatCurrency(Math.abs(a.periodBalance), currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-0.5 border-t border-slate-200 mt-1 font-medium text-xs">
                      <span>Gross {grossProfit >= 0 ? 'Profit' : 'Loss'} c/d</span>
                      <span className={`font-mono ${grossProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>{formatCurrency(Math.abs(grossProfit), currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t-2 border-slate-700 font-bold text-xs mt-1">
                      <span>Total</span><span className="font-mono">{formatCurrency(totalRevenue, currency)}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Cr (Sales Side)</p>
                    {revenueAccounts.map(a => (
                      <div key={a.id} className="flex justify-between py-0.5">
                        <span className="text-slate-700 text-xs">{a.name}</span>
                        <span className="font-mono text-xs">{formatCurrency(Math.abs(a.periodBalance), currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-1 border-t-2 border-slate-700 font-bold text-xs mt-auto">
                      <span>Total</span><span className="font-mono">{formatCurrency(totalRevenue, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. P&L Account */}
              <div className="card p-6">
                <div className="text-center mb-4">
                  <p className="text-sm font-semibold text-slate-700">Profit & Loss Account</p>
                </div>
                <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden text-sm">
                  <div className="border-r border-slate-200 p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Dr (Expenses)</p>
                    {expenseAccounts.map(a => (
                      <div key={a.id} className="flex justify-between py-0.5">
                        <span className="text-slate-700 text-xs">{a.name}</span>
                        <span className="font-mono text-xs">{formatCurrency(Math.abs(a.periodBalance), currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-0.5 border-t border-slate-200 mt-1 font-medium text-xs">
                      <span>Net {netProfit >= 0 ? 'Profit' : 'Loss'} c/d</span>
                      <span className={`font-mono ${netProfit >= 0 ? 'text-success-600' : 'text-danger-500'}`}>{formatCurrency(Math.abs(netProfit), currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t-2 border-slate-700 font-bold text-xs mt-1">
                      <span>Total</span><span className="font-mono">{formatCurrency(totalExpenses + Math.abs(grossProfit), currency)}</span>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Cr</p>
                    <div className="flex justify-between py-0.5">
                      <span className="text-slate-700 text-xs">Gross Profit b/d</span>
                      <span className="font-mono text-xs">{formatCurrency(Math.abs(grossProfit), currency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t-2 border-slate-700 font-bold text-xs mt-auto">
                      <span>Total</span><span className="font-mono">{formatCurrency(totalExpenses + Math.abs(grossProfit), currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Balance Sheet */}
              <div className="card p-6">
                <div className="text-center mb-4">
                  <p className="text-sm font-semibold text-slate-700">Balance Sheet</p>
                  <p className="text-xs text-slate-400">As at {endDate}</p>
                </div>
                {!bsBalances && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700">
                    <AlertTriangle size={13} />Balance sheet does not balance — run SUPABASE_FIX.sql
                  </div>
                )}
                <div className="space-y-1 text-sm">
                  <SectionHeader label="Assets" />
                  {assetAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(a.periodBalance, currency)} indent />)}
                  <Row label="Total Assets" value={formatCurrency(totalAssets, currency)} bold border />

                  <SectionHeader label="Liabilities" />
                  {liabAccounts.length === 0 ? <p className="text-xs text-slate-400 pl-6">No liabilities</p> :
                    liabAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(Math.abs(a.periodBalance), currency)} indent />)}
                  <Row label="Total Liabilities" value={formatCurrency(totalLiabilities, currency)} bold border />

                  <SectionHeader label="Equity" />
                  {equityAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(Math.abs(a.periodBalance), currency)} indent />)}
                  <Row label={`Net ${netProfit >= 0 ? 'Profit' : 'Loss'} for Period`}
                    value={netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}
                    indent color={netProfit >= 0 ? 'text-success-600' : 'text-danger-500'} />
                  <Row label="Total Equity" value={formatCurrency(totalEquityWithPL, currency)} bold border />

                  <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-base mt-2">
                    <span>Liabilities + Equity</span>
                    <span className={`font-mono ${bsBalances ? 'text-success-600' : 'text-danger-500'}`}>
                      {formatCurrency(totalLiabilities + totalEquityWithPL, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          ) : activeReport === 'balance' ? (
            // ── Balance Sheet standalone ─────────────────────────────────────
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Balance Sheet</p>
                <p className="text-xs text-slate-400">As at {endDate}</p>
              </div>
              {!bsBalances && (assetAccounts.length > 0 || equityAccounts.length > 0) && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700">
                  <AlertTriangle size={13} />Does not balance — run SUPABASE_FIX.sql
                </div>
              )}
              <div>
                <SectionHeader label="Assets" />
                {assetAccounts.length === 0 ? <p className="text-xs text-slate-400 pl-6">No asset balances in period</p> :
                  assetAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(a.periodBalance, currency)} indent />)}
                <Row label="Total Assets" value={formatCurrency(totalAssets, currency)} bold border />

                <SectionHeader label="Liabilities" />
                {liabAccounts.length === 0 ? <p className="text-xs text-slate-400 pl-6">No liabilities</p> :
                  liabAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(Math.abs(a.periodBalance), currency)} indent />)}
                <Row label="Total Liabilities" value={formatCurrency(totalLiabilities, currency)} bold border />

                <SectionHeader label="Equity" />
                {equityAccounts.map(a => <Row key={a.id} label={a.name} value={formatCurrency(Math.abs(a.periodBalance), currency)} indent />)}
                <Row label="Current Year Profit / (Loss)"
                  value={netProfit < 0 ? `(${formatCurrency(Math.abs(netProfit), currency)})` : formatCurrency(netProfit, currency)}
                  indent color={netProfit >= 0 ? 'text-success-600' : 'text-danger-500'} />
                <Row label="Total Equity" value={formatCurrency(totalEquityWithPL, currency)} bold border />

                <div className="flex justify-between py-3 border-t-2 border-slate-900 font-bold text-lg mt-2">
                  <span>Liabilities + Equity</span>
                  <span className={`font-mono ${bsBalances ? 'text-success-600' : 'text-danger-500'}`}>
                    {formatCurrency(totalLiabilities + totalEquityWithPL, currency)}
                  </span>
                </div>
              </div>
            </div>

          ) : activeReport === 'trial' ? (
            // ── Trial Balance ───────────────────────────────────────────────
            <div className="card p-6 max-w-2xl">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold text-slate-900">{organization?.name}</h2>
                <p className="text-sm text-slate-500">Trial Balance</p>
                <p className="text-xs text-slate-400">For the period {startDate} to {endDate}</p>
              </div>
              {!tbBalanced && tbAccounts.length > 0 && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-4 bg-red-50 text-red-700">
                  <AlertTriangle size={13} />Out of balance by {formatCurrency(Math.abs(totalTBDebit - totalTBCredit), currency)}
                </div>
              )}
              <table className="table border border-slate-200 rounded-xl overflow-hidden w-full">
                <thead><tr><th>Code</th><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
                <tbody>
                  {tbAccounts.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono text-xs text-brand-600">{a.code}</td>
                      <td className="text-sm">{a.name}</td>
                      <td className="text-right font-mono text-sm">{getDebit(a) > 0 ? formatCurrency(getDebit(a), currency) : <span className="text-slate-300">—</span>}</td>
                      <td className="text-right font-mono text-sm">{getCredit(a) > 0 ? formatCurrency(getCredit(a), currency) : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">Totals</td>
                    <td className="text-right px-4 py-3 font-mono">{formatCurrency(totalTBDebit, currency)}</td>
                    <td className={`text-right px-4 py-3 font-mono ${tbBalanced ? 'text-success-600' : 'text-danger-500'}`}>{formatCurrency(totalTBCredit, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

          ) : (
            <div className="card p-10 max-w-xl flex flex-col items-center text-center gap-3 text-slate-400">
              <FileText size={36} className="opacity-40" />
              <p className="font-medium text-slate-700">Coming soon</p>
              <p className="text-sm">This report will be generated from your live transaction data.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
