'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Plus, CheckCircle2, Clock, RefreshCw, Landmark } from 'lucide-react'
import toast from 'react-hot-toast'

export default function BankingPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: accs } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
    setAccounts(accs || [])

    if (accs && accs.length > 0) {
      const ids = accs.map((a: any) => a.id)
      const { data: txns } = await supabase
        .from('bank_transactions')
        .select('*, bank_account:bank_accounts(account_name, bank_name)')
        .in('bank_account_id', ids)
        .order('date', { ascending: false })
        .limit(30)
      setTransactions(txns || [])
    }
    setLoading(false)
  }

  const reconcile = async (id: string) => {
    await supabase.from('bank_transactions').update({ is_reconciled: true }).eq('id', id)
    toast.success('Marked as reconciled')
    load()
  }

  const totalBalance = accounts.reduce((s, a) => s + a.current_balance, 0)
  const unreconciled = transactions.filter(t => !t.is_reconciled)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Banking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bank accounts & reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} />Sync</button>
          <button className="btn-primary"><Plus size={16} />Add Account</button>
        </div>
      </div>

      {accounts.length === 0 && !loading ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3 text-slate-400">
          <Landmark size={36} className="opacity-40" />
          <div>
            <p className="font-medium text-slate-700">No bank accounts yet</p>
            <p className="text-sm mt-1">Add bank accounts in the <code className="bg-slate-100 px-1 rounded">bank_accounts</code> table in Supabase.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="card h-32 skeleton" />) :
              accounts.map(a => (
                <div key={a.id} className="card p-5" style={{ background: 'linear-gradient(135deg, #0c4a6e, #0369a1)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-blue-200" />
                      <span className="text-blue-200 text-xs">{a.bank_name}</span>
                    </div>
                    <span className="text-blue-200 text-xs">{a.account_number}</span>
                  </div>
                  <p className="text-white text-2xl font-bold">{formatCurrency(a.current_balance, a.currency || currency)}</p>
                  <p className="text-blue-200 text-sm mt-1">{a.account_name}</p>
                </div>
              ))
            }
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><CreditCard size={16} className="text-brand-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Total Balance</p>
                {loading ? <div className="skeleton h-5 w-24 rounded mt-1" /> : <p className="font-bold text-slate-900">{formatCurrency(totalBalance, currency)}</p>}
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Clock size={16} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Unreconciled</p>
                <p className="font-bold text-slate-900">{unreconciled.length} items</p>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle2 size={16} className="text-green-600" /></div>
              <div>
                <p className="text-xs text-slate-500">Reconciled</p>
                <p className="font-bold text-slate-900">{transactions.filter(t => t.is_reconciled).length} items</p>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Bank Transactions</h3>
            </div>
            {transactions.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-sm">No bank transactions yet. Import a bank statement or add transactions manually in Supabase.</p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Account</th><th className="text-right">Amount</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td className="text-xs text-slate-500">{formatDate(tx.date)}</td>
                      <td className="font-medium text-slate-800">{tx.description}</td>
                      <td className="text-xs text-slate-500">{tx.bank_account?.bank_name}</td>
                      <td className={`text-right font-mono text-sm font-semibold ${tx.type === 'credit' ? 'text-success-600' : 'text-slate-900'}`}>
                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                      </td>
                      <td>
                        {tx.is_reconciled
                          ? <span className="badge bg-green-100 text-green-700 flex items-center gap-1 w-fit"><CheckCircle2 size={10} />Reconciled</span>
                          : <span className="badge bg-amber-100 text-amber-700">Pending</span>
                        }
                      </td>
                      <td>
                        {!tx.is_reconciled && (
                          <button onClick={() => reconcile(tx.id)} className="btn-ghost text-xs text-brand-600 py-1 px-2">Reconcile</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
