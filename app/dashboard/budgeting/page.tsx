'use client'

import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, PieChart, TrendingUp, AlertTriangle } from 'lucide-react'

const BUDGET_ITEMS = [
  { account: 'Salaries', budgeted: 560000, actual: 565000, variance: -5000 },
  { account: 'Rent', budgeted: 120000, actual: 120000, variance: 0 },
  { account: 'Utilities', budgeted: 48000, actual: 53760, variance: -5760 },
  { account: 'Marketing', budgeted: 80000, actual: 42000, variance: 38000 },
  { account: 'Office Supplies', budgeted: 25000, actual: 18400, variance: 6600 },
  { account: 'Professional Fees', budgeted: 60000, actual: 0, variance: 60000 },
  { account: 'Total Revenue', budgeted: 2400000, actual: 2840000, variance: 440000 },
]

export default function BudgetingPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'

  const totalBudgeted = BUDGET_ITEMS.slice(0, -1).reduce((s, i) => s + i.budgeted, 0)
  const totalActual = BUDGET_ITEMS.slice(0, -1).reduce((s, i) => s + i.actual, 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budgets & Forecasting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plan and track your financial goals</p>
        </div>
        <button className="btn-primary"><Plus size={16} />New Budget</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><PieChart size={16} className="text-brand-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Total Budgeted (Expenses)</p>
            <p className="font-bold text-slate-900">{formatCurrency(totalBudgeted, currency)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingUp size={16} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Actual Spend</p>
            <p className="font-bold text-slate-900">{formatCurrency(totalActual, currency)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><AlertTriangle size={16} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-slate-500">Variance</p>
            <p className={`font-bold ${totalBudgeted - totalActual >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
              {formatCurrency(totalBudgeted - totalActual, currency)}
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Budget vs Actual — Feb 2026</h3>
        </div>
        <table className="table">
          <thead>
            <tr><th>Account</th><th className="text-right">Budgeted</th><th className="text-right">Actual</th><th className="text-right">Variance</th><th>Progress</th></tr>
          </thead>
          <tbody>
            {BUDGET_ITEMS.map(item => {
              const pct = item.budgeted > 0 ? Math.min(100, (item.actual / item.budgeted) * 100) : 0
              const isOver = item.variance < 0 && item.account !== 'Total Revenue'
              return (
                <tr key={item.account}>
                  <td className="font-medium text-slate-800">{item.account}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(item.budgeted, currency)}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(item.actual, currency)}</td>
                  <td className={`text-right font-mono text-sm font-semibold ${item.variance >= 0 ? 'text-success-600' : 'text-danger-500'}`}>
                    {item.variance >= 0 ? '+' : ''}{formatCurrency(item.variance, currency)}
                  </td>
                  <td className="w-32">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${isOver ? 'bg-danger-500' : pct > 80 ? 'bg-warning-500' : 'bg-success-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
