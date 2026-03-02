'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Search, Filter, Eye, FileText, TrendingUp, Clock, AlertCircle } from 'lucide-react'
import type { Transaction } from '@/types'

const TABS = ['Invoices', 'Bills', 'Expenses', 'Payments']
const TYPES: Record<number, string[]> = {
  0: ['invoice'],
  1: ['bill'],
  2: ['expense'],
  3: ['payment', 'receipt']
}

export default function TransactionsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [tab, setTab] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const currency = organization?.base_currency || 'KES'

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization, tab])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*, contact:contacts(name)')
      .eq('organization_id', organization!.id)
      .in('type', TYPES[tab])
      .order('date', { ascending: false })
      .limit(50)
    setTransactions(data || [])
    setLoading(false)
  }

  const stats = {
    total: transactions.reduce((s, t) => s + t.total, 0),
    paid: transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.total, 0),
    outstanding: transactions.filter(t => ['sent','partial','overdue'].includes(t.status)).reduce((s, t) => s + t.balance_due, 0),
    overdue: transactions.filter(t => t.status === 'overdue').length,
  }

  const filtered = transactions.filter(t =>
    !search ||
    t.number?.toLowerCase().includes(search.toLowerCase()) ||
    (t.contact as any)?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Invoices, bills, expenses & payments</p>
        </div>
        <button className="btn-primary">
          <Plus size={16} />
          New {TABS[tab].slice(0, -1)}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: FileText, color: 'text-brand-600 bg-brand-50' },
          { label: 'Paid', value: stats.paid, icon: TrendingUp, color: 'text-success-600 bg-green-50' },
          { label: 'Outstanding', value: stats.outstanding, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Overdue Count', value: stats.overdue, icon: AlertCircle, color: 'text-danger-500 bg-red-50', raw: true },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
              <s.icon size={16} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="font-bold text-slate-900 text-sm">{(s as any).raw ? s.value : formatCurrency(s.value, currency)}</p>
            </div>
          </div>
        ))}
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

      {/* Table */}
      <div className="flex gap-3 mb-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary"><Filter size={15} />Filter</button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Contact</th>
              <th>Date</th>
              <th>Due Date</th>
              <th className="text-right">Total</th>
              <th className="text-right">Balance Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No {TABS[tab].toLowerCase()} yet</p>
                </td>
              </tr>
            ) : filtered.map(tx => (
              <tr key={tx.id}>
                <td className="font-mono text-xs text-brand-600 font-semibold">{tx.number}</td>
                <td className="font-medium text-slate-800">{(tx.contact as any)?.name || '—'}</td>
                <td className="text-slate-500 text-xs">{formatDate(tx.date)}</td>
                <td className="text-slate-500 text-xs">{tx.due_date ? formatDate(tx.due_date) : '—'}</td>
                <td className="text-right font-mono text-sm font-semibold">{formatCurrency(tx.total, currency)}</td>
                <td className={`text-right font-mono text-sm ${tx.balance_due > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                  {formatCurrency(tx.balance_due, currency)}
                </td>
                <td><span className={`badge ${getStatusColor(tx.status)}`}>{tx.status}</span></td>
                <td><button className="btn-ghost p-1.5"><Eye size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
