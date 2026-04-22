'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Sparkles, TrendingUp, BarChart2, Activity, RefreshCw, AlertCircle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

export default function AnalyticsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [monthlyData, setMonthlyData]     = useState<any[]>([])
  const [ratios, setRatios]               = useState<any>({ grossMargin:0, netMargin:0, currentRatio:'N/A', debtToEquity:'N/A', revenue:0, expenses:0, profit:0 })
  const [loading, setLoading]             = useState(true)
  const [hasEntries, setHasEntries]       = useState(false)
  const [aiScenario, setAiScenario]       = useState<any>(null)
  const [scenarioLoading, setScenarioLoading] = useState(false)

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const orgId = organization!.id

    // Account balances
    const { data: accounts } = await supabase.from('accounts')
      .select('*, account_type:account_types(category, normal_balance)')
      .eq('organization_id', orgId).eq('is_active', true)

    if (accounts) {
      const getVal = (a:any) => a.account_type?.normal_balance==='credit'?Math.abs(a.balance):a.balance
      const revenue    = accounts.filter((a:any)=>a.account_type?.category==='revenue').reduce((s:number,a:any)=>s+getVal(a),0)
      const expenses   = accounts.filter((a:any)=>a.account_type?.category==='expense').reduce((s:number,a:any)=>s+getVal(a),0)
      const assets     = accounts.filter((a:any)=>a.account_type?.category==='asset').reduce((s:number,a:any)=>s+a.balance,0)
      const liabilities= accounts.filter((a:any)=>a.account_type?.category==='liability').reduce((s:number,a:any)=>s+Math.abs(a.balance),0)
      const equity     = assets-liabilities
      setRatios({
        grossMargin:  revenue>0?(((revenue-expenses*0.4)/revenue)*100).toFixed(1):'0.0',
        netMargin:    revenue>0?(((revenue-expenses)/revenue)*100).toFixed(1):'0.0',
        currentRatio: liabilities>0?(assets/liabilities).toFixed(2):'N/A',
        debtToEquity: equity>0?(liabilities/equity).toFixed(2):'N/A',
        revenue, expenses, profit: revenue-expenses,
      })
    }

    // Journal entries for chart — .neq fixes NULL is_deleted
    const { data: entries } = await supabase.from('journal_entries')
      .select('date, total_debit, total_credit, type')
      .eq('organization_id', orgId).eq('status', 'posted')
      .neq('is_deleted', true).order('date')

    setHasEntries(!!(entries && entries.length>0))

    if (entries && entries.length>0) {
      const map: Record<string,any> = {}
      entries.forEach((e:any) => {
        const month = new Date(e.date).toLocaleString('default',{ month:'short', year:'2-digit' })
        if (!map[month]) map[month] = { month, revenue:0, expenses:0 }
        if (['invoice','automatic'].includes(e.type)) map[month].revenue += e.total_credit
        else map[month].expenses += e.total_debit
      })
      setMonthlyData(Object.values(map).map((m:any)=>({ ...m, profit:m.revenue-m.expenses })))
    } else {
      setMonthlyData([])
    }
    setLoading(false)
  }

  const runScenario = async () => {
    setScenarioLoading(true)
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ stats: ratios, type:'scenario' }),
      })
      const data = await response.json()
      if (data.scenario) { setAiScenario(data.scenario) }
      else {
        setAiScenario({
          projected_revenue: (ratios.revenue||0)*0.9,
          projected_profit:  (ratios.profit||0)*0.72,
          cash_runway: 'Configure API for live analysis',
          recommendation: 'Add ANTHROPIC_API_KEY to your Vercel environment variables.',
          risk_level: 'medium',
        })
      }
    } catch {
      setAiScenario({
        projected_revenue: (ratios.revenue||0)*0.9,
        projected_profit:  (ratios.profit||0)*0.72,
        cash_runway: 'Configure API for live analysis',
        recommendation: 'Add ANTHROPIC_API_KEY to your Vercel environment variables.',
        risk_level: 'medium',
      })
    }
    setScenarioLoading(false)
  }

  const chartTooltipStyle = {
    borderRadius:'8px', border:'1px solid var(--border)', fontSize:12,
    background:'var(--bg-card)', color:'var(--text-primary)',
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Analytics & Intelligence</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>Real financial data from your accounts</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw size={14} className={loading?'animate-spin':''}/><span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* AI Scenario */}
      <div className="card p-4 sm:p-5" style={{ background:'linear-gradient(135deg,#0c4a6e,#1a73e8 60%,#7b61ff)' }}>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-blue-200"/>
            <h3 className="font-semibold text-white text-sm">AI Scenario: Revenue −10%</h3>
          </div>
          <button onClick={runScenario} disabled={scenarioLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 flex-shrink-0"
            style={{ background:'rgba(255,255,255,0.15)', color:'white' }}>
            {scenarioLoading
              ? <><span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"/>Analysing…</>
              : <><Sparkles size={11}/>Run Analysis</>}
          </button>
        </div>
        {!aiScenario ? (
          <p className="text-blue-100 text-xs sm:text-sm">Click "Run Analysis" for an AI-powered scenario simulation.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {[
                { label:'Projected Revenue', val:formatCurrency(aiScenario.projected_revenue,currency), sub:'−10% scenario', subCol:'text-red-200' },
                { label:'Projected Profit',  val:formatCurrency(aiScenario.projected_profit,currency),  sub:`Risk: ${aiScenario.risk_level}`, subCol:'text-amber-200' },
                { label:'Cash Runway',        val:aiScenario.cash_runway, sub:'', subCol:'' },
              ].map(s=>(
                <div key={s.label} className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.12)' }}>
                  <p className="text-blue-200 text-xs mb-1">{s.label}</p>
                  <p className="text-white font-bold text-sm sm:text-base">{s.val}</p>
                  {s.sub&&<p className={`text-xs mt-0.5 ${s.subCol}`}>{s.sub}</p>}
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-100 mt-4 p-3 rounded-lg" style={{ background:'rgba(255,255,255,0.08)' }}>
              💡 {aiScenario.recommendation}
            </p>
          </>
        )}
      </div>

      {/* Key Ratios — 2×2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Gross Margin',   val:`${ratios.grossMargin}%`, icon:TrendingUp, bg:'var(--success-dim)', col:'var(--success)' },
          { label:'Net Margin',     val:`${ratios.netMargin}%`,   icon:Activity,   bg:'var(--brand-dim)',   col:'var(--brand)' },
          { label:'Current Ratio',  val:ratios.currentRatio,      icon:BarChart2,  bg:'var(--purple-dim)',  col:'var(--purple)' },
          { label:'Debt-to-Equity', val:ratios.debtToEquity,      icon:TrendingUp, bg:'var(--warning-dim)', col:'var(--warning)' },
        ].map(r=>(
          <div key={r.label} className="card p-3 sm:p-4">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center mb-2 sm:mb-3" style={{ background:r.bg }}>
              <r.icon size={14} style={{ color:r.col }}/>
            </div>
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>{r.label}</p>
            {loading
              ? <div className="skeleton h-6 w-16 rounded mt-1"/>
              : <p className="text-lg sm:text-2xl font-bold mt-1" style={{ color:'var(--text-primary)' }}>{r.val}</p>}
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Total Revenue',  val:ratios.revenue,  col:'var(--success)' },
          { label:'Total Expenses', val:ratios.expenses, col:'var(--danger)' },
          { label:'Net Profit',     val:ratios.profit,   col:ratios.profit>=0?'var(--success)':'var(--danger)' },
        ].map(s=>(
          <div key={s.label} className="card p-3">
            <p className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>{s.label}</p>
            {loading ? <div className="skeleton h-5 rounded w-full"/>
              : <p className="font-bold text-xs sm:text-sm font-mono truncate" style={{ color:s.col }}>
                  {formatCurrency(s.val,currency)}
                </p>}
          </div>
        ))}
      </div>

      {/* GROUPED BAR CHART — user requested */}
      <div className="card p-4 sm:p-5">
        <h3 className="font-semibold text-sm sm:text-base mb-1" style={{ color:'var(--text-primary)' }}>
          Revenue vs Expenses vs Profit
        </h3>
        <p className="text-xs mb-4" style={{ color:'var(--text-secondary)' }}>
          {hasEntries?'From posted journal entries':'Post journal entries to see this chart'}
        </p>
        {loading ? (
          <div className="skeleton h-48 sm:h-56 rounded-xl"/>
        ) : monthlyData.length===0 ? (
          <div className="flex flex-col items-center justify-center h-40 sm:h-48 gap-2" style={{ color:'var(--text-muted)' }}>
            <BarChart2 size={28} style={{ opacity:0.3 }}/>
            <p className="text-xs sm:text-sm text-center">
              {hasEntries?'All entries are manual type — no invoice/automatic entries to chart':'No posted entries yet'}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={2} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize:10, fill:'var(--text-muted)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:10, fill:'var(--text-muted)' }} axisLine={false} tickLine={false}
                tickFormatter={v=>`${(v/1000).toFixed(0)}K`} width={32}/>
              <Tooltip formatter={(v:number)=>formatCurrency(v,currency)} contentStyle={chartTooltipStyle}/>
              <Legend iconSize={10} wrapperStyle={{ fontSize:'11px', color:'var(--text-secondary)' }}/>
              <Bar dataKey="revenue"  name="Revenue"  fill="var(--brand)"   radius={[3,3,0,0]}/>
              <Bar dataKey="expenses" name="Expenses" fill="var(--danger)"  radius={[3,3,0,0]}/>
              <Bar dataKey="profit"   name="Profit"   fill="var(--success)" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
