'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  AlertTriangle, CheckCircle2, Activity, RefreshCw,
  Sparkles, Clock, ChevronRight, Lightbulb
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'

function fmtShort(n: number, c: string) {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const pre = c === 'KES' ? 'KES ' : `${c} `
  if (abs >= 1_000_000) return `${sign}${pre}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${pre}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${pre}${abs.toFixed(0)}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  const [stats, setStats] = useState({
    totalRevenue: 0, totalExpenses: 0, netProfit: 0,
    cashBalance: 0, accountsReceivable: 0, accountsPayable: 0,
  })
  const [revenueData,       setRevenueData]       = useState<any[]>([])
  const [expenseBreakdown,  setExpenseBreakdown]  = useState<any[]>([])
  const [recentTransactions,setRecentTransactions]= useState<any[]>([])
  const [insights,          setInsights]          = useState<any[]>([])
  const [loading,           setLoading]           = useState(true)
  const [entryCount,        setEntryCount]        = useState(0)
  const [generatingInsights,setGeneratingInsights]= useState(false)

  const loadAll = useCallback(async () => {
    if (!organization) return
    setLoading(true)
    const orgId = organization.id

    // ── 1. Account balances (trigger-maintained, always accurate) ────────────
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, balance, account_type:account_types(category, normal_balance)')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (accounts) {
      const getVal = (a: any) =>
        a.account_type?.normal_balance === 'credit' ? Math.abs(a.balance) : a.balance

      const revenue  = accounts
        .filter(a => a.account_type?.category === 'revenue')
        .reduce((s, a) => s + getVal(a), 0)
      const expenses = accounts
        .filter(a => a.account_type?.category === 'expense')
        .reduce((s, a) => s + getVal(a), 0)
      const cash = accounts
        .filter(a => ['1000','1010'].includes(a.code))
        .reduce((s, a) => s + a.balance, 0)
      const bank = accounts
        .filter(a => a.code?.startsWith('11'))
        .reduce((s, a) => s + a.balance, 0)
      const ar = accounts.find(a => a.code === '1200')?.balance || 0
      const ap = accounts.find(a => a.code === '2000')?.balance || 0

      setStats({
        totalRevenue: revenue, totalExpenses: expenses,
        netProfit: revenue - expenses,
        cashBalance: cash + bank,
        accountsReceivable: Math.max(0, ar),
        accountsPayable:    Math.abs(Math.min(0, ap)),
      })

      setExpenseBreakdown(
        accounts
          .filter(a => a.account_type?.category === 'expense' && Math.abs(a.balance) > 0)
          .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
          .slice(0, 6)
          .map((a, i) => ({
            name: a.name.replace(' Expense','').replace(' & Wages',''),
            value: Math.abs(a.balance),
            color: ['#1a73e8','#7b61ff','#1e8e3e','#e37400','#d93025','#80868b'][i],
          }))
      )
    }

    // ── 2. Journal entries for chart ──────────────────────────────────────────
    // .neq('is_deleted', true) matches both NULL and false — fixes the bug
    // where entries created before the column existed were excluded
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('date, total_debit, total_credit, type, status')
      .eq('organization_id', orgId)
      .eq('status', 'posted')
      .neq('is_deleted', true)          // ← KEY FIX: matches NULL and false
      .order('date', { ascending: true })

    setEntryCount(entries?.length || 0)

    if (entries && entries.length > 0) {
      const map: Record<string, { revenue: number; expenses: number }> = {}
      entries.forEach((e: any) => {
        const m = new Date(e.date).toLocaleString('default', { month: 'short', year: '2-digit' })
        if (!map[m]) map[m] = { revenue: 0, expenses: 0 }
        if (['invoice','automatic'].includes(e.type)) map[m].revenue  += e.total_credit
        else                                          map[m].expenses += e.total_debit
      })
      setRevenueData(Object.entries(map).map(([month, v]) => ({ month, ...v, profit: v.revenue - v.expenses })))
    } else {
      setRevenueData([])
    }

    // ── 3. Recent transactions ────────────────────────────────────────────────
    const { data: txns } = await supabase
      .from('transactions')
      .select('*, contact:contacts(name)')
      .eq('organization_id', orgId)
      .order('date', { ascending: false })
      .limit(5)
    setRecentTransactions(txns || [])

    // ── 4. AI insights ────────────────────────────────────────────────────────
    const { data: ai } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(4)
    setInsights(ai || [])

    setLoading(false)
  }, [organization])

  useEffect(() => { if (organization) loadAll() }, [organization])

  const generateInsights = async () => {
    if (!organization) return
    setGeneratingInsights(true)
    try {
      const res  = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error.message || data.error); setGeneratingInsights(false); return }
      await supabase.from('ai_insights').insert(
        data.insights.map((i: any) => ({
          organization_id: organization.id,
          type: i.type || 'suggestion',
          title: i.title, description: i.description,
          severity: i.severity || 'info', is_read: false,
        }))
      )
      toast.success('AI insights generated!')
      loadAll()
    } catch (e: any) { toast.error('Failed: ' + e.message) }
    setGeneratingInsights(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={loadAll} disabled={loading} className="btn-secondary flex-shrink-0">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* KPI Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue',     value: stats.totalRevenue,   icon: TrendingUp,  col: 'var(--success)',  bg: 'var(--success-dim)' },
          { label: 'Expenses',    value: stats.totalExpenses,  icon: TrendingDown,col: 'var(--danger)',   bg: 'var(--danger-dim)' },
          { label: 'Net Profit',  value: stats.netProfit,      icon: DollarSign,  col: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', bg: stats.netProfit >= 0 ? 'var(--success-dim)' : 'var(--danger-dim)' },
          { label: 'Cash & Bank', value: stats.cashBalance,    icon: CreditCard,  col: 'var(--brand)',    bg: 'var(--brand-dim)' },
        ].map(s => (
          <div key={s.label} className="card p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between gap-1">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg }}>
                <s.icon size={14} style={{ color: s.col }} />
              </div>
            </div>
            {loading
              ? <div className="skeleton h-6 w-full rounded" />
              : <p className="text-base sm:text-xl font-bold font-mono leading-tight" style={{ color: s.col }}>
                  {fmtShort(s.value, currency)}
                </p>
            }
          </div>
        ))}
      </div>

      {/* Secondary stats — 1 col mobile, 3 desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Accounts Receivable', value: stats.accountsReceivable, icon: Clock,     col: 'var(--warning)', bg: 'var(--warning-dim)' },
          { label: 'Accounts Payable',    value: stats.accountsPayable,    icon: CreditCard, col: 'var(--danger)',  bg: 'var(--danger-dim)' },
          { label: 'Unread AI Insights',  value: null, display: `${insights.length} alerts`, icon: Activity, col: 'var(--purple)', bg: 'var(--purple-dim)' },
        ].map(s => (
          <div key={s.label} className="card p-3 sm:p-4 flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon size={15} style={{ color: s.col }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
              {loading && s.value !== null
                ? <div className="skeleton h-4 w-24 rounded mt-1" />
                : <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {s.display ?? fmtShort(s.value!, currency)}
                  </p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Charts — stack on mobile, side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h3 className="font-semibold text-sm sm:text-base mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Revenue vs Expenses
          </h3>
          <p className="text-xs mb-3 sm:mb-4" style={{ color: 'var(--text-secondary)' }}>
            {entryCount > 0
              ? `From ${entryCount} posted journal entr${entryCount === 1 ? 'y' : 'ies'}`
              : 'Post journal entries to see chart'}
          </p>
          {revenueData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 sm:h-48 gap-2"
              style={{ color: 'var(--text-muted)' }}>
              <TrendingUp size={24} style={{ opacity: 0.3 }} />
              <p className="text-xs text-center">
                {entryCount === 0
                  ? 'No posted entries found — post entries in Accounting'
                  : 'All entries are manual type — chart shows invoice/automatic entries'}
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1a73e8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#d93025" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#d93025" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8eaed" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9aa0a6' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9aa0a6' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}K`} width={32} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #dadce0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue"  stroke="#1a73e8" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#d93025" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-sm sm:text-base mb-0.5" style={{ color: 'var(--text-primary)' }}>
            Expense Breakdown
          </h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>By account balance</p>
          {expenseBreakdown.length === 0 ? (
            <div className="flex items-center justify-center h-28 sm:h-36"
              style={{ color: 'var(--text-muted)' }}>
              <p className="text-xs text-center">No expenses posted yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={28} outerRadius={50}
                    dataKey="value" strokeWidth={2} stroke="#fff">
                    {expenseBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                    contentStyle={{ borderRadius: 8, border: '1px solid #dadce0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expenseBreakdown.slice(0, 5).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <span className="font-semibold font-mono flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {fmtShort(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Insights + Recent Transactions — stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AI Insights */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--purple-dim)' }}>
              <Sparkles size={13} style={{ color: 'var(--purple)' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>AI Insights</h3>
            {insights.length > 0 && <span className="ai-badge">{insights.length} new</span>}
            <button onClick={generateInsights} disabled={generatingInsights}
              className="btn-secondary text-xs ml-auto py-1 px-3">
              <Sparkles size={12} />
              {generatingInsights ? 'Analysing…' : 'Generate'}
            </button>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2"
              style={{ color: 'var(--text-muted)' }}>
              <Lightbulb size={24} style={{ opacity: 0.3 }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No insights yet</p>
              <p className="text-xs">Click Generate for AI-powered analysis</p>
            </div>
          ) : (
            <div className="space-y-2">
              {insights.map(ins => {
                const cfg: Record<string, { bg: string; col: string }> = {
                  warning:  { bg: 'var(--warning-dim)',  col: 'var(--warning)' },
                  positive: { bg: 'var(--success-dim)',  col: 'var(--success)' },
                  critical: { bg: 'var(--danger-dim)',   col: 'var(--danger)' },
                  info:     { bg: 'var(--brand-dim)',    col: 'var(--brand)' },
                }
                const c = cfg[ins.severity] || cfg.info
                return (
                  <div key={ins.id} className="flex gap-3 p-3 rounded-lg"
                    style={{ background: c.bg, border: `1px solid ${c.col}40` }}>
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" style={{ color: c.col }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{ins.title}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ins.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Recent Transactions
            </h3>
            <a href="/dashboard/transactions" className="btn-ghost text-xs py-1"
              style={{ color: 'var(--brand)' }}>
              View all <ChevronRight size={12} />
            </a>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2"
              style={{ color: 'var(--text-muted)' }}>
              <CheckCircle2 size={24} style={{ opacity: 0.3 }} />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {(tx.contact as any)?.name || tx.number}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {tx.number} · {formatDate(tx.date)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs sm:text-sm font-bold font-mono"
                      style={{ color: ['bill','expense'].includes(tx.type) ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {['bill','expense'].includes(tx.type) ? '-' : '+'}{fmtShort(tx.total, currency)}
                    </span>
                    <span className="badge text-xs px-2 py-0.5" style={{
                      background: tx.status === 'paid' ? 'var(--success-dim)' : tx.status === 'overdue' ? 'var(--danger-dim)' : 'var(--warning-dim)',
                      color:      tx.status === 'paid' ? 'var(--success)'     : tx.status === 'overdue' ? 'var(--danger)'     : 'var(--warning)',
                    }}>{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
