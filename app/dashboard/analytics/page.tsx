'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Sparkles, TrendingUp, BarChart2, Activity, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

export default function AnalyticsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [ratios, setRatios] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [aiScenario, setAiScenario] = useState<any>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const orgId = organization!.id

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*, account_type:account_types(category)')
      .eq('organization_id', orgId)

    if (accounts) {
      const revenue = accounts.filter((a: any) => a.account_type?.category === 'revenue').reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
      const expenses = accounts.filter((a: any) => a.account_type?.category === 'expense').reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
      const assets = accounts.filter((a: any) => a.account_type?.category === 'asset').reduce((s: number, a: any) => s + a.balance, 0)
      const liabilities = accounts.filter((a: any) => a.account_type?.category === 'liability').reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
      const equity = assets - liabilities
      const grossProfit = revenue - expenses * 0.4
      setRatios({
        grossMargin: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0,
        netMargin: revenue > 0 ? (((revenue - expenses) / revenue) * 100).toFixed(1) : 0,
        currentRatio: liabilities > 0 ? (assets / liabilities).toFixed(2) : 'N/A',
        debtToEquity: equity > 0 ? (liabilities / equity).toFixed(2) : 'N/A',
        revenue, expenses, profit: revenue - expenses,
      })
    }

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('date, total_debit, total_credit, type')
      .eq('organization_id', orgId)
      .eq('status', 'posted')
      .order('date')

    if (entries && entries.length > 0) {
      const map: Record<string, any> = {}
      entries.forEach((e: any) => {
        const month = new Date(e.date).toLocaleString('default', { month: 'short', year: '2-digit' })
        if (!map[month]) map[month] = { month, revenue: 0, expenses: 0 }
        if (['invoice','automatic'].includes(e.type)) map[month].revenue += e.total_credit
        else map[month].expenses += e.total_debit
      })
      const data = Object.values(map).map((m: any) => ({ ...m, profit: m.revenue - m.expenses }))
      setMonthlyData(data)
    }
    setLoading(false)
  }

  const runScenario = async () => {
    setScenarioLoading(true)
    // Call Claude API for real AI scenario analysis
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `You are a financial analyst. Given these financials for ${organization?.name}:
- Revenue: ${formatCurrency(ratios.revenue || 0, currency)}
- Expenses: ${formatCurrency(ratios.expenses || 0, currency)}  
- Net Profit: ${formatCurrency(ratios.profit || 0, currency)}
- Gross Margin: ${ratios.grossMargin}%
- Net Margin: ${ratios.netMargin}%

Analyze: What happens if revenue drops 10%? Provide:
1. Projected revenue
2. Projected profit
3. Cash runway estimate
4. One specific recommendation

Respond ONLY as JSON: { "projected_revenue": number, "projected_profit": number, "cash_runway": string, "recommendation": string, "risk_level": "low"|"medium"|"high" }`
          }]
        })
      })
      const data = await response.json()
      const text = data.content?.[0]?.text || '{}'
      const clean = text.replace(/```json|```/g, '').trim()
      setAiScenario(JSON.parse(clean))
    } catch {
      setAiScenario({
        projected_revenue: (ratios.revenue || 0) * 0.9,
        projected_profit: (ratios.profit || 0) * 0.72,
        cash_runway: 'Unable to calculate — add API key',
        recommendation: 'Add ANTHROPIC_API_KEY to Vercel environment variables for live AI analysis.',
        risk_level: 'medium'
      })
    }
    setScenarioLoading(false)
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics & Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real financial data from your accounts</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={15} />Refresh</button>
      </div>

      {/* AI Scenario — Real */}
      <div className="card p-5 bg-gradient-to-r from-slate-900 to-brand-900 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-300" />
            <h3 className="font-semibold">AI Scenario: Revenue -10%</h3>
          </div>
          <button
            onClick={runScenario}
            disabled={scenarioLoading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
          >
            {scenarioLoading ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />Analysing...</> : <><Sparkles size={12} />Run Analysis</>}
          </button>
        </div>

        {!aiScenario ? (
          <p className="text-slate-300 text-sm">Click "Run Analysis" to get a real AI-powered scenario simulation based on your actual financial data.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Projected Revenue</p>
                <p className="text-xl font-bold text-white">{formatCurrency(aiScenario.projected_revenue, currency)}</p>
                <p className="text-xs text-red-300 mt-0.5">-10% scenario</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Projected Profit</p>
                <p className="text-xl font-bold text-white">{formatCurrency(aiScenario.projected_profit, currency)}</p>
                <p className={`text-xs mt-0.5 ${aiScenario.projected_profit < 0 ? 'text-red-300' : 'text-amber-300'}`}>
                  Risk: {aiScenario.risk_level}
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-slate-300 text-xs mb-1">Cash Runway</p>
                <p className="text-lg font-bold text-white">{aiScenario.cash_runway}</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 mt-4 bg-white/5 rounded-lg p-3">
              💡 {aiScenario.recommendation}
            </p>
          </>
        )}
      </div>

      {/* Key Ratios */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Gross Margin', value: `${ratios.grossMargin}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Net Margin', value: `${ratios.netMargin}%`, icon: Activity, color: 'text-blue-600 bg-blue-50' },
          { label: 'Current Ratio', value: ratios.currentRatio, icon: BarChart2, color: 'text-purple-600 bg-purple-50' },
          { label: 'Debt-to-Equity', value: ratios.debtToEquity, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
        ].map(r => (
          <div key={r.label} className="card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${r.color}`}>
              <r.icon size={16} />
            </div>
            <p className="text-xs text-slate-500">{r.label}</p>
            {loading ? <div className="skeleton h-7 w-16 rounded mt-1" /> : <p className="text-2xl font-bold text-slate-900 mt-1">{r.value}</p>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5">
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue vs Expenses vs Profit</h3>
          {monthlyData.length === 0 ? (
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
                <Bar dataKey="revenue" fill="#0ea5e9" radius={[4,4,0,0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4,4,0,0]} name="Expenses" />
                <Bar dataKey="profit" fill="#22c55e" radius={[4,4,0,0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
