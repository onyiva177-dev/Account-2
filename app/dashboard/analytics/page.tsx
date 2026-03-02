'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  ScatterChart, Scatter, AreaChart, Area
} from 'recharts'

const MONTHLY = [
  { month: 'Aug', revenue: 420, expenses: 310, profit: 110 },
  { month: 'Sep', revenue: 380, expenses: 280, profit: 100 },
  { month: 'Oct', revenue: 510, expenses: 360, profit: 150 },
  { month: 'Nov', revenue: 490, expenses: 320, profit: 170 },
  { month: 'Dec', revenue: 620, expenses: 410, profit: 210 },
  { month: 'Jan', revenue: 590, expenses: 390, profit: 200 },
  { month: 'Feb', revenue: 680, expenses: 440, profit: 240 },
  { month: 'Mar', revenue: 720, expenses: 460, profit: 260 },
]

const CASHFLOW = [
  { week: 'W1', inflow: 280, outflow: 190 },
  { week: 'W2', inflow: 320, outflow: 240 },
  { week: 'W3', inflow: 250, outflow: 180 },
  { week: 'W4', inflow: 410, outflow: 290 },
]

const RATIOS = [
  { name: 'Current Ratio', value: 2.4, benchmark: 2.0, status: 'good' },
  { name: 'Quick Ratio', value: 1.8, benchmark: 1.0, status: 'good' },
  { name: 'Gross Margin', value: 42.5, benchmark: 35.0, status: 'good', pct: true },
  { name: 'Net Margin', value: 15.2, benchmark: 10.0, status: 'good', pct: true },
  { name: 'ROE', value: 22.4, benchmark: 15.0, status: 'good', pct: true },
  { name: 'Debt-to-Equity', value: 0.45, benchmark: 1.0, status: 'good' },
]

export default function AnalyticsPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Analytics & Intelligence</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered financial analysis</p>
        </div>
        <button className="btn-primary">
          <Sparkles size={15} />
          Generate AI Report
        </button>
      </div>

      {/* Scenario Simulation */}
      <div className="card p-5 bg-gradient-to-r from-slate-900 to-brand-900 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-brand-300" />
          <h3 className="font-semibold">AI Scenario Simulation</h3>
          <span className="ai-badge ml-2 !bg-white/10 !text-white">Beta</span>
        </div>
        <p className="text-slate-300 text-sm mb-4">
          What happens if revenue drops 10% next quarter?
        </p>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-300 text-xs mb-1">Projected Revenue</p>
            <p className="text-xl font-bold text-white">{formatCurrency(648000, currency)}</p>
            <p className="text-xs text-red-300 mt-0.5">-10% scenario</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-300 text-xs mb-1">Projected Profit</p>
            <p className="text-xl font-bold text-white">{formatCurrency(188000, currency)}</p>
            <p className="text-xs text-red-300 mt-0.5">-28% impact</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-300 text-xs mb-1">Cash Runway</p>
            <p className="text-xl font-bold text-white">8.2 months</p>
            <p className="text-xs text-amber-300 mt-0.5">Reduced from 11.4</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
          <AlertTriangle size={11} />
          AI recommendation: Build emergency fund of at least {formatCurrency(240000, currency)} to buffer a 10% revenue drop
        </p>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-5">
        {/* Revenue Trend */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Revenue vs Profit Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={MONTHLY} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v * 1000, currency)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#0ea5e9" radius={[4,4,0,0]} name="Revenue" />
              <Bar dataKey="profit" fill="#22c55e" radius={[4,4,0,0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cash Flow */}
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Weekly Cash Flow</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={CASHFLOW}>
              <defs>
                <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}K`} />
              <Tooltip formatter={(v: number) => formatCurrency(v * 1000, currency)} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="inflow" stroke="#22c55e" strokeWidth={2} fill="url(#inGrad)" name="Inflow" />
              <Area type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={2} fill="url(#outGrad)" name="Outflow" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Ratios */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Key Financial Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          {RATIOS.map(ratio => (
            <div key={ratio.name} className="bg-slate-50 rounded-xl p-4">
              <p className="text-xs text-slate-500 mb-1">{ratio.name}</p>
              <p className="text-2xl font-bold text-slate-900">
                {ratio.value}{(ratio as any).pct ? '%' : 'x'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <TrendingUp size={11} className="text-success-500" />
                <span className="text-xs text-success-600">
                  Above benchmark ({ratio.benchmark}{(ratio as any).pct ? '%' : 'x'})
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success-500 rounded-full"
                  style={{ width: `${Math.min(100, (ratio.value / (ratio.benchmark * 2)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
