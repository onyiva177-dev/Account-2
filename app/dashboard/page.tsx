'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  AlertTriangle, CheckCircle2, Activity, RefreshCw,
  Sparkles, Clock, ChevronRight, Lightbulb, AlertCircle
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

function fmt(n: number, c: string) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : ''
  const p = c === 'KES' ? 'KES ' : `${c} `
  if (abs >= 1_000_000) return `${sign}${p}${(abs/1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}${p}${(abs/1_000).toFixed(0)}K`
  return `${sign}${p}${abs.toFixed(0)}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  const [stats, setStats]   = useState({
    revenue: 0, expenses: 0, netProfit: 0,
    cash: 0, ar: 0, ap: 0,
  })
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [expenseBreak, setExpenseBreak] = useState<any[]>([])
  const [recentTxns, setRecentTxns]   = useState<any[]>([])
  const [insights, setInsights]       = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [recalcing, setRecalcing]     = useState(false)
  const [genAI, setGenAI]             = useState(false)

  // ── Core data loader ─────────────────────────────────────────────────────
  // Reads directly from journal_lines (not cached account.balance) so data
  // is always accurate even after direct DB edits.
  const load = useCallback(async (recalc = false) => {
    if (!organization) return
    setLoading(true)
    const orgId = organization.id

    if (recalc) {
      setRecalcing(true)
      // Recalculate all account balances from journal_lines
      const { data: allLines } = await supabase
        .from('journal_lines')
        .select('account_id, debit, credit, journal_entry:journal_entries!inner(status, organization_id, is_deleted)')
        .eq('journal_entry.organization_id', orgId)
        .eq('journal_entry.status', 'posted')
        .eq('journal_entry.is_deleted', false)

      if (allLines) {
        const balMap: Record<string, number> = {}
        for (const l of allLines) {
          balMap[l.account_id] = (balMap[l.account_id] || 0) + l.debit - l.credit
        }
        const { data: accs } = await supabase.from('accounts').select('id').eq('organization_id', orgId)
        if (accs) {
          await Promise.all(accs.map(a =>
            supabase.from('accounts').update({ balance: balMap[a.id] ?? 0 }).eq('id', a.id)
          ))
        }
      }
      setRecalcing(false)
    }

    // ── Fetch accounts with their type ──────────────────────────────────
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id, code, name, balance, account_type:account_types(category, normal_balance)')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (accounts) {
      // Aggregate by category using the correct sign convention:
      // debit-normal (asset, expense): positive balance = Dr
      // credit-normal (liability, equity, revenue): negative balance = Cr → use Math.abs
      const getVal = (a: Account) =>
  a.account_type?.[0]?.normal_balance === 'credit'
    ? Math.abs(a.balance)
    : a.balance


interface AccountType {
  category: string;
  normal_balance: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  balance: number;
  account_type?: AccountType[];   // <-- array
}

      
const revenue = accounts
  .filter((a: Account) => a.account_type?.[0]?.category === 'revenue')
  .reduce((s, a) => s + getVal(a), 0)

const expenses = accounts
  .filter((a: Account) => a.account_type?.[0]?.category === 'expense')
  .reduce((s, a) => s + getVal(a), 0)


      // Cash: code 1000/1010/petty cash
      const cash = accounts.filter(a => ['1000','1010'].includes(a.code))
                            .reduce((s, a) => s + a.balance, 0)
      // Bank: codes starting 11
      const bank = accounts.filter(a => a.code?.startsWith('11'))
                            .reduce((s, a) => s + a.balance, 0)
      // AR / AP
      const ar = accounts.find(a => a.code === '1200')?.balance || 0
      const ap = accounts.find(a => a.code === '2000')?.balance || 0

      setStats({
        revenue, expenses,
        netProfit: revenue - expenses,
        cash: cash + bank,
        ar: Math.max(0, ar),
        ap: Math.abs(Math.min(0, ap)),
      })

      // Expense breakdown pie
      setExpenseBreak(
  accounts
    .filter((a: Account) => a.account_type?.[0]?.category === 'expense' && getVal(a) > 0)
    .sort((a, b) => getVal(b) - getVal(a))
    .slice(0, 6)
    .map((a, i) => ({
      name: a.name.replace(' Expense', "").replace(' & Wages', ""),
      value: getVal(a),
      color: ['#2f81f7','#bc8cff','#3fb950','#d29922','#f85149','#58a6ff'][i]
    }))
)

    }

    // ── Monthly revenue vs expenses from journal_entries ─────────────────
    const { data: entries } = await supabase
      .from('journal_entries')
      .select('date, total_debit, total_credit, type')
      .eq('organization_id', orgId)
      .eq('status', 'posted')
      .eq('is_deleted', false)
      .order('date', { ascending: true })

    if (entries && entries.length > 0) {
      const map: Record<string, { revenue: number; expenses: number }> = {}
      entries.forEach((e: any) => {
        const m = new Date(e.date).toLocaleString('default', { month: 'short', year: '2-digit' })
        if (!map[m]) map[m] = { revenue: 0, expenses: 0 }
        if (['invoice','automatic'].includes(e.type)) map[m].revenue  += e.total_credit
        else                                          map[m].expenses += e.total_debit
      })
      setMonthlyData(
        Object.entries(map).map(([month, v]) => ({ month, ...v, profit: v.revenue - v.expenses }))
      )
    }

    // ── Recent transactions ───────────────────────────────────────────────
    const { data: txns } = await supabase
      .from('transactions')
      .select('*, contact:contacts(name)')
      .eq('organization_id', orgId)
      .order('date', { ascending: false })
      .limit(5)
    setRecentTxns(txns || [])

    // ── Unread AI insights ────────────────────────────────────────────────
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

  useEffect(() => { if (organization) load() }, [organization])

  const generateInsights = async () => {
    if (!organization) return
    setGenAI(true)
    try {
      const res  = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error.message || data.error); setGenAI(false); return }
      await supabase.from('ai_insights').insert(
        data.insights.map((i: any) => ({
          organization_id: organization.id,
          type: i.type || 'suggestion',
          title: i.title, description: i.description,
          severity: i.severity || 'info', is_read: false,
        }))
      )
      toast.success('AI insights generated')
      load()
    } catch (e: any) { toast.error('Failed: ' + e.message) }
    setGenAI(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  const noData = !loading && stats.revenue === 0 && stats.expenses === 0

  // Chart colors
  const chartTooltipStyle = {
    backgroundColor: '#1c2128',
    border: '1px solid #30363d',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e6edf3',
  }

  return (
    <div className="space-y-5 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={loading || recalcing}
          className="btn-secondary flex-shrink-0 text-xs sm:text-sm">
          <RefreshCw size={14} className={(loading || recalcing) ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{recalcing ? 'Recalculating…' : 'Refresh'}</span>
        </button>
      </div>

      {/* No data warning */}
      {noData && (
        <div className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'var(--warning-dim)', border: '1px solid var(--warning)' }}>
          <AlertCircle size={16} style={{ color: 'var(--warning)' }} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm" style={{ color: 'var(--warning)' }}>
            No posted journal entries yet — post entries in Accounting to see live data here.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue',     value: stats.revenue,   icon: TrendingUp,  col: 'var(--success)',  bg: 'var(--success-dim)' },
          { label: 'Expenses',    value: stats.expenses,  icon: TrendingDown,col: 'var(--danger)',   bg: 'var(--danger-dim)' },
          { label: 'Net Profit',  value: stats.netProfit, icon: DollarSign,  col: stats.netProfit >= 0 ? 'var(--success)' : 'var(--danger)', bg: stats.netProfit >= 0 ? 'var(--success-dim)' : 'var(--danger-dim)' },
          { label: 'Cash & Bank', value: stats.cash,      icon: CreditCard,  col: 'var(--brand)',    bg: 'var(--brand-dim)' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.bg }}>
                <s.icon size={15} style={{ color: s.col }} />
              </div>
            </div>
            {loading
              ? <div className="skeleton h-6 w-full rounded" />
              : <p className="text-xl font-bold font-mono" style={{ color: s.col }}>
                  {fmt(s.value, currency)}
                </p>
            }
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Accounts Receivable', value: stats.ar, icon: Clock,     col: 'var(--warning)', bg: 'var(--warning-dim)' },
          { label: 'Accounts Payable',    value: stats.ap, icon: CreditCard, col: 'var(--danger)',  bg: 'var(--danger-dim)' },
          { label: 'Unread AI Insights',  value: null, display: `${insights.length} alerts`, icon: Activity, col: 'var(--purple)', bg: 'var(--purple-dim)' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}>
              <s.icon size={16} style={{ color: s.col }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              {loading && s.value !== null
                ? <div className="skeleton h-4 w-24 rounded mt-1" />
                : <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {s.display || fmt(s.value!, currency)}
                  </p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Revenue vs Expenses</h3>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>From posted journal entries</p>
          {monthlyData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 gap-2">
              <TrendingUp size={28} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Post entries to see chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2f81f7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2f81f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f85149" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f85149" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#484f58' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}K`} width={36} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)}
                  contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="revenue"  stroke="#2f81f7" strokeWidth={2} fill="url(#rev)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#f85149" strokeWidth={2} fill="url(#exp)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Expense Breakdown</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>By account balance</p>
          {expenseBreak.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No expenses posted yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={expenseBreak} cx="50%" cy="50%" innerRadius={30} outerRadius={52}
                    dataKey="value" strokeWidth={2} stroke="#1c2128">
                    {expenseBreak.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={chartTooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expenseBreak.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <span className="font-medium font-mono flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                      {fmt(item.value, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Insights + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* AI Insights */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--purple-dim)' }}>
              <Sparkles size={13} style={{ color: 'var(--purple)' }} />
            </div>
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>AI Insights</h3>
            {insights.length > 0 && <span className="ai-badge">{insights.length} new</span>}
            <button onClick={generateInsights} disabled={genAI} className="btn-secondary text-xs ml-auto py-1 px-3">
              <Sparkles size={12} />
              {genAI ? 'Analysing…' : 'Generate'}
            </button>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Lightbulb size={28} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No insights yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Click Generate for AI-powered analysis</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map(ins => {
                const cfg: Record<string, { bg: string; col: string }> = {
                  warning:  { bg: 'var(--warning-dim)',  col: 'var(--warning)' },
                  positive: { bg: 'var(--success-dim)',  col: 'var(--success)' },
                  critical: { bg: 'var(--danger-dim)',   col: 'var(--danger)' },
                  info:     { bg: 'var(--brand-dim)',    col: 'var(--brand)' },
                }
                const c = cfg[ins.severity] || cfg.info
                return (
                  <div key={ins.id} className="flex gap-3 p-3 rounded-xl"
                    style={{ background: c.bg, border: `1px solid ${c.col}30` }}>
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: c.col }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ins.title}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{ins.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Recent Transactions</h3>
            <a href="/dashboard/transactions" className="btn-ghost text-xs py-1 px-2" style={{ color: 'var(--brand)' }}>
              View all <ChevronRight size={12} />
            </a>
          </div>
          {loading ? (
            <div className="space-y-3">{Array(4).fill(0).map((_,i) =>
              <div key={i} className="skeleton h-10 rounded-xl" />
            )}</div>
          ) : recentTxns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CheckCircle2 size={28} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTxns.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 gap-3"
                  style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {(tx.contact as any)?.name || tx.number}
                    </p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {tx.number} · {formatDate(tx.date)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-sm font-semibold font-mono"
                      style={{ color: ['bill','expense'].includes(tx.type) ? 'var(--danger)' : 'var(--text-primary)' }}>
                      {['bill','expense'].includes(tx.type) ? '-' : '+'}{fmt(tx.total, currency)}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: tx.status === 'paid'    ? 'var(--success-dim)' :
                                  tx.status === 'overdue' ? 'var(--danger-dim)'  :
                                  tx.status === 'partial' ? 'var(--brand-dim)'   : 'var(--warning-dim)',
                      color:      tx.status === 'paid'    ? 'var(--success)' :
                                  tx.status === 'overdue' ? 'var(--danger)'  :
                                  tx.status === 'partial' ? 'var(--brand)'   : 'var(--warning)',
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
