'use client'

import { useEffect, useState } from 'react'
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

// ─── Compact number formatter for mobile KPI cards ──────────────────────────
// "KES 33,000.00" overflows a 2-col mobile card → use "KES 33K" on small screens
function formatCompact(amount: number, currency: string): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  const prefix = currency === 'KES' ? 'KES ' : `${currency} `
  if (abs >= 1_000_000) return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${prefix}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${prefix}${abs.toFixed(0)}`
}

export default function DashboardPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  const [stats, setStats] = useState({
    totalRevenue: 0, totalExpenses: 0, netProfit: 0,
    cashBalance: 0, accountsReceivable: 0, accountsPayable: 0,
  })
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [expenseBreakdown, setExpenseBreakdown] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [insights, setInsights] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generatingInsights, setGeneratingInsights] = useState(false)

  useEffect(() => {
    if (!organization) return
    loadAll()
  }, [organization])

  const loadAll = async () => {
    setLoading(true)
    const orgId = organization!.id

    const { data: accounts } = await supabase
      .from('accounts')
      .select('*, account_type:account_types(category, normal_balance)')
      .eq('organization_id', orgId)
      .eq('is_active', true)

    if (accounts) {
      const revenue = accounts.filter((a: any) => a.account_type?.category === 'revenue').reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
      const expenses = accounts.filter((a: any) => a.account_type?.category === 'expense').reduce((s: number, a: any) => s + Math.abs(a.balance), 0)
      const cash = accounts.filter((a: any) => ['1000', '1010'].includes(a.code)).reduce((s: number, a: any) => s + a.balance, 0)
      const bankBal = accounts.filter((a: any) => a.code?.startsWith('11')).reduce((s: number, a: any) => s + a.balance, 0)
      const ar = accounts.find((a: any) => a.code === '1200')?.balance || 0
      const ap = accounts.find((a: any) => a.code === '2000')?.balance || 0

      setStats({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netProfit: revenue - expenses,
        cashBalance: cash + bankBal,
        accountsReceivable: ar,
        accountsPayable: Math.abs(ap),
      })

      const expAccounts = accounts
        .filter((a: any) => a.account_type?.category === 'expense' && a.balance !== 0)
        .slice(0, 6)
        .map((a: any, i: number) => ({
          name: a.name.replace(' Expense', '').replace(' & Wages', ''),
          value: Math.abs(a.balance),
          color: ['#0ea5e9','#a855f7','#f59e0b','#22c55e','#ef4444','#94a3b8'][i]
        }))
      setExpenseBreakdown(expAccounts)
    }

    const { data: entries } = await supabase
      .from('journal_entries')
      .select('date, total_debit, total_credit, type')
      .eq('organization_id', orgId)
      .eq('status', 'posted')
      .order('date', { ascending: true })

    if (entries && entries.length > 0) {
      const monthMap: Record<string, { revenue: number, expenses: number }> = {}
      entries.forEach((e: any) => {
        const month = new Date(e.date).toLocaleString('default', { month: 'short' })
        if (!monthMap[month]) monthMap[month] = { revenue: 0, expenses: 0 }
        if (['invoice', 'automatic'].includes(e.type)) monthMap[month].revenue += e.total_credit
        else monthMap[month].expenses += e.total_debit
      })
      setRevenueData(Object.entries(monthMap).map(([month, v]) => ({ month, ...v })))
    }

    const { data: txns } = await supabase
      .from('transactions')
      .select('*, contact:contacts(name)')
      .eq('organization_id', orgId)
      .order('date', { ascending: false })
      .limit(5)
    setRecentTransactions(txns || [])

    const { data: aiInsights } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(4)
    setInsights(aiInsights || [])

    setLoading(false)
  }

  const generateInsights = async () => {
    if (!organization) return
    setGeneratingInsights(true)
    try {
      const response = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats })
      })
      const data = await response.json()
      if (data.error) {
        toast.error('AI error: ' + data.error.message || data.error)
        setGeneratingInsights(false)
        return
      }
      await supabase.from('ai_insights').insert(
        data.insights.map((i: any) => ({
          organization_id: organization!.id,
          type: i.type || 'suggestion',
          title: i.title,
          description: i.description,
          severity: i.severity || 'info',
          is_read: false,
        }))
      )
      toast.success('AI insights generated!')
      loadAll()
    } catch (e: any) {
      toast.error('Failed: ' + e.message)
    }
    setGeneratingInsights(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={loadAll} className="btn-secondary flex-shrink-0 text-xs sm:text-sm">
          <RefreshCw size={14} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {/* FIX: text-2xl overflows 2-col mobile cards.
          Solution: use compact format (e.g. "KES 33K") on mobile,
          full format on sm+ screens. Font size also scales down. */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { title: 'Revenue', value: stats.totalRevenue, icon: TrendingUp, sub: 'All revenue accounts', iconBg: 'bg-green-50', iconColor: 'text-green-600' },
          { title: 'Expenses', value: stats.totalExpenses, icon: TrendingDown, sub: 'All expense accounts', iconBg: 'bg-red-50', iconColor: 'text-red-500' },
          { title: 'Net Profit', value: stats.netProfit, icon: DollarSign, sub: 'Revenue minus expenses', iconBg: 'bg-brand-50', iconColor: 'text-brand-600' },
          { title: 'Cash & Bank', value: stats.cashBalance, icon: CreditCard, sub: 'Cash + bank balances', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
        ].map(s => (
          <div key={s.title} className="card p-3 sm:p-5 flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between">
              {/* Shorten title on mobile */}
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-tight">{s.title}</p>
              <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                <s.icon size={14} className={`sm:w-[18px] sm:h-[18px] ${s.iconColor}`} />
              </div>
            </div>
            <div>
              {loading ? (
                <div className="skeleton h-6 sm:h-7 w-full rounded mt-1" />
              ) : (
                <>
                  {/* Mobile: compact (e.g. KES 33K) | Desktop: full */}
                  <p className={`font-bold tracking-tight leading-none ${
                    s.value < 0 ? 'text-red-500' : 'text-slate-900'
                  }`}>
                    {/* Compact value shown on mobile, hidden on sm+ */}
                    <span className="text-lg sm:hidden">
                      {s.value < 0 && <span className="text-red-500">-</span>}
                      {formatCompact(Math.abs(s.value), currency)}
                    </span>
                    {/* Full value hidden on mobile, shown on sm+ */}
                    <span className="hidden sm:inline text-2xl">
                      {formatCurrency(s.value, currency)}
                    </span>
                  </p>
                </>
              )}
              <p className="text-xs text-slate-400 mt-1 leading-tight hidden sm:block">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Secondary stats ──────────────────────────────────────────────────── */}
      {/* FIX: grid-cols-3 is too cramped on mobile → scroll horizontally or stack */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Accounts Receivable', value: stats.accountsReceivable, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', Icon: Clock },
          { label: 'Accounts Payable', value: stats.accountsPayable, iconBg: 'bg-red-50', iconColor: 'text-red-500', Icon: CreditCard },
          { label: 'Unread AI Insights', value: null, display: `${insights.length} alerts`, iconBg: 'bg-purple-50', iconColor: 'text-purple-600', Icon: Activity },
        ].map(s => (
          <div key={s.label} className="card p-3 sm:p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
              <s.Icon size={16} className={s.iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{s.label}</p>
              {loading && s.value !== null ? (
                <div className="skeleton h-5 w-28 rounded mt-1" />
              ) : (
                <p className="font-bold text-slate-900 text-sm truncate">
                  {s.display || formatCurrency(s.value!, currency)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────────── */}
      {/* FIX: grid-cols-3 with col-span-2 breaks on mobile → stack vertically */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h3 className="font-semibold text-slate-900 mb-0.5 text-sm sm:text-base">Revenue vs Expenses</h3>
          <p className="text-xs text-slate-500 mb-4">From posted journal entries</p>
          {revenueData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 sm:h-48 text-slate-400 gap-2">
              <TrendingUp size={28} className="opacity-30" />
              <p className="text-sm text-center">Post journal entries to see chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} width={36} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <h3 className="font-semibold text-slate-900 mb-0.5 text-sm sm:text-base">Expense Breakdown</h3>
          <p className="text-xs text-slate-500 mb-3">By account balance</p>
          {expenseBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
              <p className="text-xs text-center">Post expenses to see breakdown</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={36} outerRadius={58} dataKey="value" strokeWidth={2} stroke="#fff">
                    {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expenseBreakdown.slice(0, 4).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-slate-600 truncate">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-900 flex-shrink-0">{formatCompact(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── AI Insights + Recent Transactions ─────────────────────────────────── */}
      {/* FIX: grid-cols-2 on mobile puts two narrow panels side by side → stack */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles size={13} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">AI Insights</h3>
            {insights.length > 0 && <span className="ai-badge">{insights.length} new</span>}
            <button
              onClick={generateInsights}
              disabled={generatingInsights}
              className="btn-secondary text-xs ml-auto py-1 px-3"
            >
              <Sparkles size={12} />
              {generatingInsights ? 'Analyzing...' : 'Generate'}
            </button>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
              <Lightbulb size={28} className="opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium text-slate-500">No insights yet</p>
                <p className="text-xs mt-1">Click Generate for AI-powered financial insights</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map(insight => (
                <div key={insight.id} className={`flex gap-3 p-3 rounded-xl border ${
                  insight.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                  insight.severity === 'positive' ? 'bg-green-50 border-green-200' :
                  insight.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                }`}>
                  <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-slate-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Recent Transactions</h3>
            <a href="/dashboard/transactions" className="btn-ghost text-brand-600 text-xs">
              View all <ChevronRight size={13} />
            </a>
          </div>
          {loading ? (
            <div className="space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2">
              <CheckCircle2 size={28} className="opacity-30" />
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs text-center">Create your first invoice or bill to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{(tx.contact as any)?.name || tx.number}</p>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{tx.number} · {formatDate(tx.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-sm font-semibold ${['bill','expense'].includes(tx.type) ? 'text-red-500' : 'text-slate-900'}`}>
                      {['bill','expense'].includes(tx.type) ? '-' : '+'}{formatCompact(tx.total, currency)}
                    </span>
                    <span className={`badge text-xs ${
                      tx.status === 'paid' ? 'bg-green-100 text-green-700' :
                      tx.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      tx.status === 'partial' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {tx.status}
                    </span>
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
