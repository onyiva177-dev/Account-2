'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, PieChart, TrendingUp, AlertTriangle, FileX, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BudgetingPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [budgets, setBudgets] = useState<any[]>([])
  const [selectedBudget, setSelectedBudget] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewBudget, setShowNewBudget] = useState(false)
  const [saving, setSaving] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ name: '', status: 'draft' })
  const [budgetLines, setBudgetLines] = useState([{ account_id: '', amount: '', notes: '' }])

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const [{ data: bs }, { data: accs }] = await Promise.all([
      supabase.from('budgets').select('*').eq('organization_id', organization!.id).order('created_at', { ascending: false }),
      supabase.from('accounts').select('id, name, code, account_type:account_types(category)').eq('organization_id', organization!.id).eq('is_active', true).order('code'),
    ])
    setBudgets(bs || [])
    setAccounts(accs || [])
    if (bs && bs.length > 0) {
      setSelectedBudget(bs[0])
      loadLines(bs[0].id)
    } else {
      setLoading(false)
    }
  }

  const loadLines = async (budgetId: string) => {
    const { data: ls } = await supabase
      .from('budget_lines')
      .select('*, account:accounts(name, code)')
      .eq('budget_id', budgetId)
    setLines(ls || [])
    setLoading(false)
  }

  const selectBudget = (b: any) => {
    setSelectedBudget(b)
    loadLines(b.id)
  }

  const addBudgetLine = () => setBudgetLines(p => [...p, { account_id: '', amount: '', notes: '' }])
  const removeBudgetLine = (i: number) => setBudgetLines(p => p.filter((_, idx) => idx !== i))
  const updateLine = (i: number, k: string, v: string) => {
    const updated = [...budgetLines]
    updated[i] = { ...updated[i], [k]: v }
    setBudgetLines(updated)
  }

  const saveBudget = async () => {
    if (!budgetForm.name) return toast.error('Budget name is required')
    const validLines = budgetLines.filter(l => l.account_id && l.amount)
    if (validLines.length === 0) return toast.error('Add at least one budget line')
    setSaving(true)

    const total = validLines.reduce((s, l) => s + Number(l.amount), 0)

    const { data: budget, error } = await supabase
      .from('budgets')
      .insert({
        organization_id: organization!.id,
        name: budgetForm.name,
        status: budgetForm.status,
        total_budget: total,
      })
      .select().single()

    if (error) { toast.error('Failed to create budget'); setSaving(false); return }

    await supabase.from('budget_lines').insert(
      validLines.map(l => ({
        budget_id: budget.id,
        account_id: l.account_id,
        amount: Number(l.amount),
        notes: l.notes,
      }))
    )

    toast.success('Budget created!')
    setShowNewBudget(false)
    setBudgetForm({ name: '', status: 'draft' })
    setBudgetLines([{ account_id: '', amount: '', notes: '' }])
    setSaving(false)
    load()
  }

  const totalBudgeted = lines.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Budgets & Forecasting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Plan and track your financial goals</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewBudget(true)}>
          <Plus size={16} />New Budget
        </button>
      </div>

      {loading ? (
        <div className="card p-8 flex justify-center"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div></div>
      ) : budgets.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3 text-slate-400">
          <FileX size={36} className="opacity-40" />
          <div>
            <p className="font-medium text-slate-700">No budgets created yet</p>
            <p className="text-sm mt-1">Click "New Budget" to create your first budget.</p>
          </div>
          <button onClick={() => setShowNewBudget(true)} className="btn-primary mt-2"><Plus size={15} />Create Budget</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Budgeted', value: formatCurrency(totalBudgeted, currency), icon: PieChart, color: 'text-brand-600 bg-brand-50' },
              { label: 'Budget Lines', value: `${lines.length} accounts`, icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
              { label: 'Active Budgets', value: `${budgets.length}`, icon: AlertTriangle, color: 'text-green-600 bg-green-50' },
            ].map(s => (
              <div key={s.label} className="card p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={16} /></div>
                <div><p className="text-xs text-slate-500">{s.label}</p><p className="font-bold text-slate-900">{s.value}</p></div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {budgets.map(b => (
              <button key={b.id} onClick={() => selectBudget(b)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${selectedBudget?.id === b.id ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                {b.name}
              </button>
            ))}
          </div>

          {lines.length === 0 ? (
            <div className="card p-8 text-center text-slate-400 text-sm">No budget lines for this budget yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="table">
                <thead><tr><th>Account</th><th>Code</th><th className="text-right">Budgeted Amount</th><th>Notes</th></tr></thead>
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

      {/* New Budget Modal */}
      {showNewBudget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">New Budget</h2>
              <button onClick={() => setShowNewBudget(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="input-label">Budget Name *</label><input className="input" placeholder="e.g. Q1 2026 Operating Budget" value={budgetForm.name} onChange={e => setBudgetForm(p => ({ ...p, name: e.target.value }))} /></div>
                <div>
                  <label className="input-label">Status</label>
                  <select className="input" value={budgetForm.status} onChange={e => setBudgetForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="input-label mb-0">Budget Lines</label>
                  <button onClick={addBudgetLine} className="btn-ghost text-xs text-brand-600"><Plus size={13} />Add Line</button>
                </div>
                <div className="space-y-2">
                  {budgetLines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <select className="input text-xs" value={line.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}>
                          <option value="">Select account...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input type="number" className="input text-xs" placeholder="Amount" value={line.amount} onChange={e => updateLine(i, 'amount', e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <input className="input text-xs" placeholder="Notes" value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeBudgetLine(i)} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {budgetLines.some(l => l.amount) && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
                    <p className="text-sm font-semibold text-slate-900">
                      Total: {formatCurrency(budgetLines.reduce((s, l) => s + (Number(l.amount) || 0), 0), currency)}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowNewBudget(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveBudget} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Create Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
