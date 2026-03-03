'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, PieChart, TrendingUp, AlertTriangle, FileX } from 'lucide-react'

export default function BudgetingPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [budgets, setBudgets] = useState<any[]>([])
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: bs } = await supabase
      .from('budgets')
      .select('*')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false })
    setBudgets(bs || [])

    if (bs && bs.length > 0) {
      const { data: ls } = await supabase
        .from('budget_lines')
        .select('*, account:accounts(name, code), budget:budgets(name)')
        .eq('budget_id', bs[0].id)
      setLines(ls || [])
    }
    setLoading(false)
  }

  const totalBudgeted = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budgets & Forecasting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plan and track your financial goals</p>
        </div>
        <button className="btn-primary"><Plus size={16} />New Budget</button>
      </div>

      {loading ? (
        <div className="card p-8 flex justify-center"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div></div>
      ) : budgets.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3 text-slate-400">
          <FileX size={36} className="opacity-40" />
          <div>
            <p className="font-medium text-slate-700">No budgets created yet</p>
            <p className="text-sm mt-1">Create a budget by adding records to the <code className="bg-slate-100 px-1 rounded">budgets</code> and <code className="bg-slate-100 px-1 rounded">budget_lines</code> tables in Supabase.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><PieChart size={16} className="text-brand-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Total Budgeted</p>
                <p className="font-bold text-slate-900">{formatCurrency(totalBudgeted, currency)}</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingUp size={16} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Budget Lines</p>
                <p className="font-bold text-slate-900">{lines.length} accounts</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><AlertTriangle size={16} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Active Budgets</p>
                <p className="font-bold text-slate-900">{budgets.length}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mb-2">
            {budgets.map(b => (
              <button key={b.id} onClick={() => {}} className="px-4 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                {b.name}
              </button>
            ))}
          </div>

          {lines.length === 0 ? (
            <div className="card p-8 text-center text-slate-400 text-sm">No budget lines for this budget yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="table">
                <thead>
                  <tr><th>Account</th><th>Code</th><th className="text-right">Budgeted Amount</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {lines.map(l => (
                    <tr key={l.id}>
                      <td className="font-medium text-slate-800">{l.account?.name || '—'}</td>
                      <td className="font-mono text-xs text-brand-600">{l.account?.code || '—'}</td>
                      <td className="text-right font-mono text-sm font-semibold">{formatCurrency(l.amount, currency)}</td>
                      <td className="text-xs text-slate-500">{l.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-4 py-3">Total</td>
                    <td className="text-right px-4 py-3 font-mono">{formatCurrency(totalBudgeted, currency)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
