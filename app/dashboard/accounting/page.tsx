'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Search, Filter, Eye, Edit2, CheckCircle2, BookOpen, Sparkles, AlertCircle, X, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import type { JournalEntry, Account } from '@/types'

const TABS = ['Journal Entries', 'Chart of Accounts', 'Trial Balance']

export default function AccountingPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [tab, setTab] = useState(0)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [search, setSearch] = useState('')
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { account_id: '', description: '', debit: 0, credit: 0 },
      { account_id: '', description: '', debit: 0, credit: 0 },
    ]
  })

  useEffect(() => {
    if (!organization) return
    loadData()
  }, [organization, tab])

  const loadData = async () => {
    setLoading(true)
    if (tab === 0) {
      const { data } = await supabase
        .from('journal_entries')
        .select('*, journal_lines(*, account:accounts(code, name))')
        .eq('organization_id', organization!.id)
        .order('date', { ascending: false })
        .limit(50)
      setEntries(data || [])
    } else {
      const { data } = await supabase
        .from('accounts')
        .select('*, account_type:account_types(category, normal_balance)')
        .eq('organization_id', organization!.id)
        .eq('is_active', true)
        .order('code')
      setAccounts(data || [])
    }
    setLoading(false)
  }

  const addLine = () => setNewEntry(p => ({
    ...p,
    lines: [...p.lines, { account_id: '', description: '', debit: 0, credit: 0 }]
  }))

  const updateLine = (i: number, k: string, v: string | number) => {
    const lines = [...newEntry.lines]
    lines[i] = { ...lines[i], [k]: v }
    setNewEntry(p => ({ ...p, lines }))
  }

  const removeLine = (i: number) => {
    if (newEntry.lines.length <= 2) return
    setNewEntry(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))
  }

  const totalDebit = newEntry.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = newEntry.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01

  const saveEntry = async (status: 'draft' | 'posted') => {
    if (!newEntry.description) return toast.error('Description is required')
    if (!isBalanced) return toast.error('Debits must equal credits')
    
    const { data: entry, error } = await supabase.from('journal_entries').insert({
      organization_id: organization!.id,
      date: newEntry.date,
      description: newEntry.description,
      reference: newEntry.reference,
      status,
      type: 'manual',
      total_debit: totalDebit,
      total_credit: totalCredit,
      currency: organization!.base_currency,
    }).select().single()

    if (error) { toast.error('Failed to save entry'); return }

    await supabase.from('journal_lines').insert(
      newEntry.lines
        .filter(l => l.account_id)
        .map((l, i) => ({
          journal_entry_id: entry.id,
          account_id: l.account_id,
          description: l.description,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          line_number: i + 1
        }))
    )

    toast.success(`Journal entry ${status === 'posted' ? 'posted' : 'saved as draft'}`)
    setShowNewEntry(false)
    setNewEntry({ date: new Date().toISOString().split('T')[0], description: '', reference: '', lines: [{ account_id: '', description: '', debit: 0, credit: 0 }, { account_id: '', description: '', debit: 0, credit: 0 }] })
    loadData()
  }

  const trialBalance = accounts.reduce((acc: Record<string, { debit: number, credit: number }>, a) => {
    const cat = a.account_type?.category || 'other'
    if (!acc[cat]) acc[cat] = { debit: 0, credit: 0 }
    const normalBalance = a.account_type?.normal_balance
    if (a.balance >= 0) {
      if (normalBalance === 'debit') acc[cat].debit += a.balance
      else acc[cat].credit += a.balance
    }
    return acc
  }, {})

  const currency = organization?.base_currency || 'KES'

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Accounting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Journal entries, ledgers & chart of accounts</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNewEntry(true)}>
          <Plus size={16} />
          New Journal Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary"><Filter size={15} />Filter</button>
      </div>

      {/* Journal Entries Tab */}
      {tab === 0 && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Entry #</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(8).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded w-full" /></td>)}
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
                      <p>No journal entries yet. Create your first one!</p>
                    </td>
                  </tr>
                ) : (
                  entries
                    .filter(e => !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.entry_number?.toLowerCase().includes(search.toLowerCase()))
                    .map(entry => (
                      <tr key={entry.id}>
                        <td className="font-mono text-xs text-brand-600 font-semibold">{entry.entry_number}</td>
                        <td className="text-slate-500 text-xs">{formatDate(entry.date)}</td>
                        <td className="font-medium text-slate-800 max-w-xs truncate">{entry.description}</td>
                        <td>
                          <span className={`badge ${entry.type === 'ai_generated' ? 'ai-badge' : 'bg-slate-100 text-slate-600'}`}>
                            {entry.type === 'ai_generated' && '✨ '}{entry.type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="text-right font-mono text-sm">{formatCurrency(entry.total_debit, currency)}</td>
                        <td className="text-right font-mono text-sm">{formatCurrency(entry.total_credit, currency)}</td>
                        <td>
                          <span className={`badge ${getStatusColor(entry.status)}`}>{entry.status}</span>
                        </td>
                        <td>
                          <button className="btn-ghost p-1.5"><Eye size={14} /></button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Chart of Accounts Tab */}
      {tab === 1 && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Account Name</th>
                  <th>Category</th>
                  <th>Normal Balance</th>
                  <th className="text-right">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(8).fill(0).map((_, i) => (
                    <tr key={i}>{Array(6).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded w-full" /></td>)}</tr>
                  ))
                ) : accounts
                  .filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.code?.includes(search))
                  .map(account => (
                    <tr key={account.id}>
                      <td className="font-mono text-xs font-semibold text-brand-600">{account.code}</td>
                      <td className="font-medium text-slate-800">{account.name}</td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-600 capitalize">
                          {account.account_type?.category}
                        </span>
                      </td>
                      <td className="text-slate-500 capitalize text-xs">{account.account_type?.normal_balance}</td>
                      <td className={`text-right font-mono text-sm ${account.balance < 0 ? 'negative' : account.balance > 0 ? 'text-slate-900 font-semibold' : 'text-slate-400'}`}>
                        {formatCurrency(account.balance, account.currency || currency)}
                      </td>
                      <td><span className="dot-green" /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trial Balance */}
      {tab === 2 && (
        <div className="card p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Trial Balance</h2>
          <p className="text-sm text-slate-500 mb-6">{organization?.name} · As of {new Date().toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <table className="table border border-slate-200 rounded-xl overflow-hidden">
            <thead>
              <tr>
                <th>Account Category</th>
                <th className="text-right">Total Debit</th>
                <th className="text-right">Total Credit</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(trialBalance).map(([cat, vals]) => (
                <tr key={cat}>
                  <td className="font-medium capitalize">{cat}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(vals.debit, currency)}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(vals.credit, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td>Totals</td>
                <td className="text-right font-mono">{formatCurrency(Object.values(trialBalance).reduce((s, v) => s + v.debit, 0), currency)}</td>
                <td className="text-right font-mono">{formatCurrency(Object.values(trialBalance).reduce((s, v) => s + v.credit, 0), currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* New Journal Entry Modal */}
      {showNewEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New Journal Entry</h2>
                <p className="text-xs text-slate-500 mt-0.5">Debits must equal credits to post</p>
              </div>
              <button onClick={() => setShowNewEntry(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Header */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="input-label">Date</label>
                  <input type="date" className="input" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Description *</label>
                  <input className="input" placeholder="e.g. Monthly rent payment" value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="input-label mb-0">Line Items</label>
                  <div className="flex items-center gap-2">
                    {!isBalanced && totalDebit > 0 && (
                      <span className="text-xs text-danger-500 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Difference: {formatCurrency(Math.abs(totalDebit - totalCredit), currency)}
                      </span>
                    )}
                    {isBalanced && <span className="text-xs text-success-600 flex items-center gap-1"><CheckCircle2 size={12} />Balanced</span>}
                  </div>
                </div>
                <div className="space-y-2">
                  {newEntry.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select className="input text-xs" value={line.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)}>
                          <option value="">Select account...</option>
                          {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input className="input text-xs" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className="input text-xs text-right" placeholder="Debit" value={line.debit || ''} onChange={e => updateLine(i, 'debit', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" className="input text-xs text-right" placeholder="Credit" value={line.credit || ''} onChange={e => updateLine(i, 'credit', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeLine(i)} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-12 gap-2 mt-2 pt-2 border-t border-slate-100">
                  <div className="col-span-7 text-xs text-slate-500 font-medium">Totals</div>
                  <div className="col-span-2 text-right text-xs font-bold text-slate-900 font-mono">{formatCurrency(totalDebit, currency)}</div>
                  <div className="col-span-2 text-right text-xs font-bold text-slate-900 font-mono">{formatCurrency(totalCredit, currency)}</div>
                </div>
                <button onClick={addLine} className="btn-ghost text-xs mt-3 text-brand-600">
                  <Plus size={13} />Add line
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowNewEntry(false)} className="btn-secondary">Cancel</button>
              <div className="flex gap-2">
                <button onClick={() => saveEntry('draft')} className="btn-secondary">Save Draft</button>
                <button onClick={() => saveEntry('posted')} className="btn-primary" disabled={!isBalanced}>
                  <CheckCircle2 size={15} />
                  Post Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
