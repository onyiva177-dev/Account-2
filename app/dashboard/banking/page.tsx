'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Plus, CheckCircle2, Clock, RefreshCw } from 'lucide-react'

const ACCOUNTS = [
  { id: '1', name: 'Equity Bank — Current', number: '****4521', balance: 842000, currency: 'KES', bank: 'Equity Bank', last_sync: '2026-03-02' },
  { id: '2', name: 'KCB — Savings', number: '****8834', balance: 380000, currency: 'KES', bank: 'KCB', last_sync: '2026-03-02' },
  { id: '3', name: 'Mpesa Business Till', number: '****1122', balance: 18500, currency: 'KES', bank: 'Safaricom', last_sync: '2026-03-02' },
]

const TRANSACTIONS = [
  { id: '1', date: '2026-03-01', description: 'Customer payment — Nairobi Hospital', amount: 245000, type: 'credit', reconciled: true },
  { id: '2', date: '2026-03-01', description: 'KPLC Utility Payment', amount: 28400, type: 'debit', reconciled: true },
  { id: '3', date: '2026-02-28', description: 'Safaricom Bill Payment', amount: 18500, type: 'debit', reconciled: false },
  { id: '4', date: '2026-02-28', description: 'Customer payment — Alliance School', amount: 85000, type: 'credit', reconciled: false },
  { id: '5', date: '2026-02-27', description: 'Supplier payment — Office Depot', amount: 42000, type: 'debit', reconciled: false },
]

export default function BankingPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const totalBalance = ACCOUNTS.reduce((s, a) => s + a.balance, 0)
  const unreconciled = TRANSACTIONS.filter(t => !t.reconciled).length

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Banking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bank accounts & reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><RefreshCw size={15} />Sync Feeds</button>
          <button className="btn-primary"><Plus size={16} />Add Account</button>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="grid grid-cols-3 gap-4">
        {ACCOUNTS.map(a => (
          <div key={a.id} className="card p-5" style={{ background: 'linear-gradient(135deg, #0c4a6e, #0369a1)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-blue-200" />
                <span className="text-blue-200 text-xs">{a.bank}</span>
              </div>
              <span className="text-blue-200 text-xs">{a.number}</span>
            </div>
            <p className="text-white text-2xl font-bold">{formatCurrency(a.balance, a.currency)}</p>
            <p className="text-blue-200 text-sm mt-1">{a.name}</p>
            <p className="text-blue-300 text-xs mt-3">Synced {formatDate(a.last_sync)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3 col-span-1">
          <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
            <CreditCard size={16} className="text-brand-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Total Balance</p>
            <p className="font-bold text-slate-900">{formatCurrency(totalBalance, currency)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
            <Clock size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Unreconciled</p>
            <p className="font-bold text-slate-900">{unreconciled} items</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Reconciled (MTD)</p>
            <p className="font-bold text-slate-900">2 items</p>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Recent Bank Transactions</h3>
          <button className="btn-primary text-xs py-1.5 px-3">
            <CheckCircle2 size={13} />Reconcile
          </button>
        </div>
        <table className="table">
          <thead>
            <tr><th><input type="checkbox" className="rounded" /></th><th>Date</th><th>Description</th><th className="text-right">Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {TRANSACTIONS.map(tx => (
              <tr key={tx.id}>
                <td><input type="checkbox" className="rounded" defaultChecked={!tx.reconciled} /></td>
                <td className="text-slate-500 text-xs">{formatDate(tx.date)}</td>
                <td className="font-medium text-slate-800">{tx.description}</td>
                <td className={`text-right font-mono text-sm font-semibold ${tx.type === 'credit' ? 'text-success-600' : 'text-slate-900'}`}>
                  {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                </td>
                <td>
                  {tx.reconciled
                    ? <span className="badge bg-green-100 text-green-700 flex items-center gap-1 w-fit"><CheckCircle2 size={10} />Reconciled</span>
                    : <span className="badge bg-amber-100 text-amber-700">Pending</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
