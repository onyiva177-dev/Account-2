'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils'
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  AlertTriangle, CheckCircle2, Lightbulb, Activity,
  RefreshCw, Sparkles, ArrowUpRight, ArrowDownRight,
  Calendar, Clock, ChevronRight
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const MOCK_REVENUE_DATA = [
  { month: 'Aug', revenue: 420000, expenses: 310000 },
  { month: 'Sep', revenue: 380000, expenses: 280000 },
  { month: 'Oct', revenue: 510000, expenses: 360000 },
  { month: 'Nov', revenue: 490000, expenses: 320000 },
  { month: 'Dec', revenue: 620000, expenses: 410000 },
  { month: 'Jan', revenue: 590000, expenses: 390000 },
  { month: 'Feb', revenue: 680000, expenses: 440000 },
  { month: 'Mar', revenue: 720000, expenses: 460000 },
]

const MOCK_EXPENSE_BREAKDOWN = [
  { name: 'Salaries', value: 40, color: '#0ea5e9' },
  { name: 'Rent', value: 15, color: '#a855f7' },
  { name: 'Utilities', value: 8, color: '#f59e0b' },
  { name: 'Supplies', value: 12, color: '#22c55e' },
  { name: 'Marketing', value: 10, color: '#ef4444' },
  { name: 'Other', value: 15, color: '#94a3b8' },
]

const MOCK_INSIGHTS = [
  {
    id: '1',
    type: 'alert',
    severity: 'warning',
    title: 'Utilities increased 12% this quarter',
    description: 'Your utilities expense has grown from KES 48,000 to KES 53,760. Consider reviewing energy efficiency.',
    icon: AlertTriangle,
    color: 'text-warning-600 bg-amber-50 border-amber-200'
  },
  {
    id: '2',
    type: 'positive',
    severity: 'positive',
    title: 'Revenue up 18% vs last quarter',
    description: 'Strong performance driven by services revenue. Keep it up!',
    icon: TrendingUp,
    color: 'text-success-600 bg-green-50 border-green-200'
  },
  {
    id: '3',
    type: 'suggestion',
    severity: 'info',
    title: 'VAT filing due in 8 days',
    description: 'Your VAT return for February 2026 of KES 84,320 is due on March 10.',
    icon: Calendar,
    color: 'text-brand-600 bg-blue-50 border-brand-200'
  },
  {
    id: '4',
    type: 'forecast',
    severity: 'info',
    title: 'Cash flow forecast: positive next 30 days',
    description: 'AI projects KES +156,000 net cash position by month end based on current trends.',
    icon: Activity,
    color: 'text-accent-600 bg-purple-50 border-purple-200'
  },
]

const RECENT_TRANSACTIONS = [
  { id: '1', number: 'INV-001042', contact: 'Nairobi General Hospital', type: 'invoice', amount: 245000, status: 'paid', date: '2026-02-28' },
  { id: '2', number: 'BILL-000519', contact: 'Safaricom PLC', type: 'bill', amount: 18500, status: 'pending', date: '2026-02-27' },
  { id: '3', number: 'INV-001041', contact: 'Alliance High School', type: 'invoice', amount: 85000, status: 'partial', date: '2026-02-26' },
  { id: '4', number: 'EXP-000234', contact: 'KPLC Prepaid', type: 'expense', amount: 12400, status: 'paid', date: '2026-02-25' },
  { id: '5', number: 'INV-001040', contact: 'City Market Ltd', type: 'invoice', amount: 156000, status: 'overdue', date: '2026-02-20' },
]

function StatCard({ title, value, change, icon: Icon, currency, trend }: {
  title: string; value: number; change: number; icon: React.ElementType; currency?: string; trend: 'up' | 'down' | 'neutral'
}) {
  const isPositive = change >= 0
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
          <Icon size={18} className="text-brand-600" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 tracking-tight">
          {currency ? formatCurrency(value, currency) : value.toLocaleString()}
        </p>
        <div className="flex items-center gap-1 mt-1">
          {isPositive ? <ArrowUpRight size={14} className="text-success-600" /> : <ArrowDownRight size={14} className="text-danger-500" />}
          <span className={`text-xs font-medium ${isPositive ? 'text-success-600' : 'text-danger-500'}`}>
            {formatPercent(change)} vs last month
          </span>
        </div>
      </div>
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    paid: 'badge bg-green-100 text-green-700',
    pending: 'badge bg-amber-100 text-amber-700',
    partial: 'badge bg-blue-100 text-blue-700',
    overdue: 'badge bg-red-100 text-red-700',
  }
  return <span className={map[status] || 'badge bg-gray-100 text-gray-600'}>{status}</span>
}

export default function DashboardPage() {
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [healthScore] = useState(72)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <RefreshCw size={15} />
            Sync
          </button>
          <button className="btn-primary">
            <Sparkles size={15} />
            AI Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={2840000} change={18.2} icon={TrendingUp} currency={currency} trend="up" />
        <StatCard title="Total Expenses" value={1960000} change={7.4} icon={TrendingDown} currency={currency} trend="down" />
        <StatCard title="Net Profit" value={880000} change={31.8} icon={DollarSign} currency={currency} trend="up" />
        <StatCard title="Cash Balance" value={1240000} change={-4.2} icon={CreditCard} currency={currency} trend="down" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Accounts Receivable</p>
            <p className="font-bold text-slate-900">{formatCurrency(540000, currency)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <CreditCard size={18} className="text-red-500" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Accounts Payable</p>
            <p className="font-bold text-slate-900">{formatCurrency(228000, currency)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Activity size={18} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Financial Health Score</p>
            <div className="flex items-center gap-2">
              <p className="font-bold text-slate-900">{healthScore}/100</p>
              <div className="flex-1 bg-slate-100 rounded-full h-2 w-20">
                <div className="bg-success-500 h-2 rounded-full" style={{ width: `${healthScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Revenue vs Expenses Chart */}
        <div className="card p-5 col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-semibold text-slate-900">Revenue vs Expenses</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 8 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-500 inline-block" />Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-400 inline-block" />Expenses</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={MOCK_REVENUE_DATA}>
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
              <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-1">Expense Breakdown</h3>
          <p className="text-xs text-slate-500 mb-4">Current month</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={MOCK_EXPENSE_BREAKDOWN} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={2} stroke="#fff">
                {MOCK_EXPENSE_BREAKDOWN.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {MOCK_EXPENSE_BREAKDOWN.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-medium text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Insights + Recent Transactions */}
      <div className="grid grid-cols-2 gap-6">
        {/* AI Insights */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-purple-100 flex items-center justify-center">
              <Sparkles size={13} className="text-purple-600" />
            </div>
            <h3 className="font-semibold text-slate-900">AI Insights</h3>
            <span className="ai-badge ml-auto">4 new</span>
          </div>
          <div className="space-y-3">
            {MOCK_INSIGHTS.map(insight => {
              const Icon = insight.icon
              return (
                <div key={insight.id} className={`flex gap-3 p-3 rounded-xl border ${insight.color}`}>
                  <Icon size={16} className="flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Transactions</h3>
            <button className="btn-ghost text-brand-600 text-xs">View all <ChevronRight size={13} /></button>
          </div>
          <div className="space-y-3">
            {RECENT_TRANSACTIONS.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{tx.contact}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{tx.number} · {formatDate(tx.date)}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                  <span className={`text-sm font-semibold ${tx.type === 'bill' || tx.type === 'expense' ? 'text-danger-500' : 'text-slate-900'}`}>
                    {tx.type === 'bill' || tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount, currency)}
                  </span>
                  <StatusBadge status={tx.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
