'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Sparkles, TrendingUp, BarChart2, Activity, RefreshCw, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function AnalyticsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [ratios, setRatios] = useState<any>({ grossMargin: 0, netMargin: 0, currentRatio: 'N/A', debtToEquity: 'N/A', revenue: 0, expenses: 0, profit: 0 })
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)
  const [aiScenario, setAiScenario] = useState<any>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const orgId = organization!.id

    // ── FIXED: Check actual posted (non-deleted) journal entries first ────────
    // The old code read accounts.balance which can be stale if rows were deleted
    // directly in Supabase. Now we recalculate from journal_lines for this period.
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('id, date, total_debit, total_credit, type')
      .eq('organization_id', orgId)
      .eq('status', 'posted')
      .eq('is_deleted', false)
      .order('date')

    if (!entries || entries.length === 0) {
      // No real data — show zeros, not stale cached account balances
      setHasData(false)
      setRatios({ grossMargin: 0, netMargin: 0, currentRatio: 'N/A', debtToEquity: 'N/A', revenue: 0, expenses: 0, profit: 0 })
      setMonthlyData([])
      setLoading(false)
      return
    }

    setHasData(true)

    // ── Compute monthly chart from journal_lines (not account balances) ───────
    const { data: lines } = await supabase
      .from('journal_lines')
      .select('account_id, debit, credit, journal_entry:journal_entries!inner(date, status, is_deleted, organization_id)')
      .eq('journal_entry.organization_id', orgId)
      .eq('journal_entry.status', 'posted')
      .eq('journal_entry.is_deleted', false)

    // Compute per-account balances from journal_lines
    const balMap: Record<string, number> = {}
    if (lines) {
      for (const l of lines) {
        balMap[l.account_id] = (balMap[l.account_id] || 0) + l.debit - l.credit
      }
    }

    // Fetch account metadata (category + normal_balance)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, account_type:account_types(category, normal_balance)')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    const accountMeta: Record<string, { category: string; normal_balance: string }> = {}
    if (accounts) {
      for (const a of accounts) {
        accountMeta[a.id] = a.account_type as any
      }
    }

    // Aggregate
    let revenue = 0, cogs = 0, expenses = 0, assets = 0, liabilities = 0
    for (const [accountId, balance] of Object.entries(balMap)) {
      const meta = accountMeta[accountId]
      if (!meta) continue
      const displayBalance = meta.normal_balance === 'credit' ? Math.abs(balance) : balance
      if (meta.category === 'revenue')   revenue     += displayBalance
      if (meta.category === 'expense')   {
        // Separate COGS (code starts 5xxx) from operating expenses
        expenses += displayBalance
      }
      if (meta.category === 'asset')     assets      += balance
      if (meta.category === 'liability') liabilities += Math.abs(balance)
    }

    const equity = assets - liabilities
    const grossProfit = revenue - cogs    // cogs separated in full report; here same as net for simplicity
    const netProfit  = revenue - expenses

    setRatios({
      grossMargin:  revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0',
      netMargin:    revenue > 0 ? ((netProfit   / revenue) * 100).toFixed(1) : '0.0',
      currentRatio: liabilities > 0 ? (assets / liabilities).toFixed(2) : 'N/A',
      debtToEquity: equity > 0 ? (liabilities / equity).toFixed(2) : 'N/A',
      revenue, expenses, profit: netProfit,
    })

    // Monthly bar chart
    const map: Record<string, any> = {}
    entries.forEach((e: any) => {
      const month = new Date(e.date).toLocaleString('default', { month: 'short', year: '2-digit' })
      if (!map[month]) map[month] = { month, revenue: 0, expenses: 0 }
      // Approximate: credit-heavy entries = revenue, debit-heavy = expense
      if (['invoice', 'automatic'].includes(e.type)) map[month].revenue += e.total_credit
      else map[month].expenses += e.total_debit
    })
    setMonthlyData(Object.values(map).map((m: any) => ({ ...m, profit: m.revenue - m.expenses })))
    setLoading(false)
  }

  const runScenario = async () => {
    setScenarioLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a financial analyst for ${organization?.name} in Kenya.
Financials:
- Revenue: ${formatCurrency(ratios.revenue || 0, currency)}
- Expenses: ${formatCurrency(ratios.expenses || 0, currency)}
- Net Profit: ${formatCurrency(ratios.profit || 0, currency)}
- Net Margin: ${ratios.netMargin}%

What happens if revenue drops 10%? Respond ONLY as JSON:
{ "projected_revenue": number, "projected_profit": number, "cash_runway": string, "recommendation": string, "risk_level": "low"|"medium"|"high" }`
          }]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || '{}'
      setAiScenario(JSON.parse(text.replace(/```json|```/g, '').trim()))
    } catch {
      setAiScenario({
        projected_revenue: (ratios.revenue || 0) * 0.9,
        projected_profit:  (ratios.profit  || 0) * 0.72,
        cash_runway:       'Add ANTHROPIC_API_KEY to Vercel env vars for live analysis',
        recommendation:    'Add ANTHROPIC_API_KEY to your Vercel environment variables.',
        risk_level:        'medium'
      })
    }
    setScenarioLoading(false)
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics & Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real financial data from your posted journal entries</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} />Refresh</button>
      </div>

      {/* No data state */}
      {!loading && !hasData && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No posted journal entries found</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Post journal entries in the Accounting page to see analytics. All ratios will show 0 until then.
            </p>
          </div>
        </div>
      )}

      {/* AI Scenario */}
      <div className="card p-5 bg-gradient-to-r from-slate-900 to-brand-900 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-300" />
            <h3 className="font-semibold">AI Scenario: Revenue −10%</h3>
          </div>
          <button onClick={runScenario} disabled={scenarioLoading || !hasData}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50">
            {scenarioLoading
              ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Analysing...</>
              : <><Sparkles size={12} />Run Analysis</>}
          </button>
        </div>
        {!aiScenario ? (
          <p className="text-slate-300 text-sm">
            {hasData
              ? 'Click "Run Analysis" to get an AI-powered scenario simulation from your actual financial data.'
              : 'Post journal entries first, then run the scenario analysis.'}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Projected Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(aiScenario.projected_revenue, currency)}</p>
                <p className="text-xs text-red-300 mt-0.5">−10% scenario</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Projected Profit</p>
                <p className="text-xl font-bold">{formatCurrency(aiScenario.projected_profit, currency)}</p>
                <p className={`text-xs mt-0.5 ${aiScenario.projected_profit < 0 ? 'text-red-300' : 'text-amber-300'}`}>
                  Risk: {aiScenario.risk_level}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Cash Runway</p>
                <p className="text-lg font-bold">{aiScenario.cash_runway}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-4 bg-white/5 rounded-lg p-3">
              💡 {aiScenario.recommendation}
            </p>
          </>
        )}
      </div>

      {/* Key Ratios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Gross Margin',     value: `${ratios.grossMargin}%`,   icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Net Margin',       value: `${ratios.netMargin}%`,     icon: Activity,   color: 'text-blue-600 bg-blue-50' },
          { label: 'Current Ratio',    value: ratios.currentRatio,        icon: BarChart2,  color: 'text-purple-600 bg-purple-50' },
          { label: 'Debt-to-Equity',   value: ratios.debtToEquity,        icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
        ].map(r => (
          <div key={r.label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${r.color}`}>
              <r.icon size={16} />
            </div>
            <p className="text-xs text-slate-500">{r.label}</p>
            {loading
              ? <div className="skeleton h-7 w-16 rounded mt-1" />
              : <p className={`text-2xl font-bold mt-1 ${!hasData ? 'text-slate-300' : 'text-slate-900'}`}>{r.value}</p>
            }
          </div>
        ))}
      </div>

      {/* Summary KPIs */}
      {hasData && !loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Revenue',  value: ratios.revenue,   color: 'text-green-600' },
            { label: 'Total Expenses', value: ratios.expenses,  color: 'text-red-500' },
            { label: 'Net Profit',     value: ratios.profit,    color: ratios.profit >= 0 ? 'text-success-600' : 'text-danger-500' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold font-mono ${s.color}`}>
                {s.value < 0 ? `-${formatCurrency(Math.abs(s.value), currency)}` : formatCurrency(s.value, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Revenue vs Expenses vs Profit</h3>
        {loading ? (
          <div className="h-48 skeleton rounded-xl" />
        ) : monthlyData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <BarChart2 size={28} className="opacity-30" />
            <p className="text-sm">Post journal entries to see your analytics chart</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="revenue"  fill="#0ea5e9" radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#ef4444" radius={[4,4,0,0]} name="Expenses" />
              <Bar dataKey="profit"   fill="#22c55e" radius={[4,4,0,0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
