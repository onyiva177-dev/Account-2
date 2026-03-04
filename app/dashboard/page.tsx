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
    const text = data.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    await supabase.from('ai_insights').insert(
      parsed.map((i: any) => ({
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
  } catch (e) {
    toast.error('Failed to generate insights')
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
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button onClick={loadAll} className="btn-secondary">
          <RefreshCw size={15} />Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Revenue', value: stats.totalRevenue, icon: TrendingUp, sub: 'All revenue accounts' },
          { title: 'Total Expenses', value: stats.totalExpenses, icon: TrendingDown, sub: 'All expense accounts' },
          { title: 'Net Profit', value: stats.netProfit, icon: DollarSign, sub: 'Revenue minus expenses' },
          { title: 'Cash & Bank', value: stats.cashBalance, icon: CreditCard, sub: 'Cash + bank balances' },
        ].map(s => (
          <div key={s.title} className="stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500 font-medium">{s.title}</p>
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                <s.icon size={18} className="text-brand-600" />
              </div>
            </div>
            <div>
              {loading
                ? <div className="skeleton h-7 w-36 rounded mt-1" />
                : <p className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(s.value, currency)}</p>
              }
              <p className="text-xs text-slate-400 mt-1">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Accounts Receivable</p>
            {loading ? <div className="skeleton h-5 w-28 rounded mt-1" /> : <p className="font-bold text-slate-900">{formatCurrency(stats.accountsReceivable, currency)}</p>}
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <CreditCard size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Accounts Payable</p>
            {loading ? <div className="skeleton h-5 w-28 rounded mt-1" /> : <p className="font-bold text-slate-900">{formatCurrency(stats.accountsPayable, currency)}</p>}
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Activity size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Unread AI Insights</p>
            <p className="font-bold text-slate-900">{insights.length} alerts</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-2">
          <h3 className="font-semibold text-slate-900 mb-1">Revenue vs Expenses</h3>
          <p className="text-xs text-slate-500 mb-4">From posted journal entries</p>
          {revenueData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <TrendingUp size={28} className="opacity-30" />
              <p className="text-sm text-center">No posted entries yet — post journal entries to see your chart</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
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
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revGrad)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Expense Breakdown</h3>
          <p className="text-xs text-slate-500 mb-3">By account balance</p>
          {expenseBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
              <p className="text-xs text-center">Post expenses to see breakdown</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={expenseBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="#fff">
                    {expenseBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {expenseBreakdown.slice(0, 4).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-slate-600 truncate max-w-20">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-900">{formatCurrency(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Insights + Recent Transactions */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles size={13} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900">AI Insights</h3>
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
                <p className="text-xs mt-1">Click Generate to get AI-powered financial insights</p>
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
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5 text-slate-500" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
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
              <p className="text-xs">Create your first invoice or bill to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{(tx.contact as any)?.name || tx.number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{tx.number} · {formatDate(tx.date)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                    <span className={`text-sm font-semibold ${['bill','expense'].includes(tx.type) ? 'text-red-500' : 'text-slate-900'}`}>
                      {['bill','expense'].includes(tx.type) ? '-' : '+'}{formatCurrency(tx.total, currency)}
                    </span>
                    <span className={`badge ${
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
