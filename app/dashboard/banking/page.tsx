'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CreditCard, Plus, CheckCircle2, Clock, RefreshCw, Landmark, X, Upload, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK_ACCOUNT = { bank_name: '', account_name: '', account_number: '', account_type: 'current', currency: 'KES', current_balance: '' }
const BLANK_TXN = { bank_account_id: '', date: new Date().toISOString().split('T')[0], description: '', amount: '', type: 'credit', reference: '' }

export default function BankingPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [accounts, setAccounts] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddTxn, setShowAddTxn] = useState(false)
  const [accForm, setAccForm] = useState<typeof BLANK_ACCOUNT>(BLANK_ACCOUNT)
  const [txnForm, setTxnForm] = useState<typeof BLANK_TXN>(BLANK_TXN)
  const [saving, setSaving] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: accs } = await supabase.from('bank_accounts').select('*')
      .eq('organization_id', organization!.id).eq('is_active', true)
    setAccounts(accs || [])

    if (accs && accs.length > 0) {
      const ids = accs.map((a: any) => a.id)
      const { data: txns } = await supabase.from('bank_transactions')
        .select('*, bank_account:bank_accounts(account_name, bank_name)')
        .in('bank_account_id', ids)
        .order('date', { ascending: false }).limit(50)
      setTransactions(txns || [])
      if (!selectedAccount && accs.length > 0) setSelectedAccount(accs[0].id)
    }
    setLoading(false)
  }

  const saveAccount = async () => {
    if (!accForm.bank_name || !accForm.account_name) { toast.error('Bank name and account name are required'); return }
    setSaving(true)
    const { error } = await supabase.from('bank_accounts').insert({
      organization_id: organization!.id,
      bank_name:       accForm.bank_name,
      account_name:    accForm.account_name,
      account_number:  accForm.account_number || null,
      account_type:    accForm.account_type,
      currency:        accForm.currency || currency,
      current_balance: Number(accForm.current_balance) || 0,
      is_active:       true,
    })
    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
    toast.success(`${accForm.account_name} added`)
    setShowAddAccount(false); setAccForm(BLANK_ACCOUNT); setSaving(false); load()
  }

  const saveTxn = async () => {
    if (!txnForm.bank_account_id || !txnForm.description || !txnForm.amount) {
      toast.error('Account, description and amount are required'); return
    }
    setSaving(true)
    const amount = Number(txnForm.amount)
    const acc = accounts.find(a => a.id === txnForm.bank_account_id)

    // Insert transaction
    const { error } = await supabase.from('bank_transactions').insert({
      organization_id: organization!.id,
      bank_account_id: txnForm.bank_account_id,
      date:            txnForm.date,
      description:     txnForm.description,
      amount,
      type:            txnForm.type,
      reference:       txnForm.reference || null,
      is_reconciled:   false,
    })
    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }

    // Update running balance on bank account
    const newBalance = acc
      ? acc.current_balance + (txnForm.type === 'credit' ? amount : -amount)
      : 0
    await supabase.from('bank_accounts').update({ current_balance: newBalance }).eq('id', txnForm.bank_account_id)

    toast.success('Transaction recorded')
    setShowAddTxn(false); setTxnForm(BLANK_TXN); setSaving(false); load()
  }

  const reconcile = async (id: string) => {
    await supabase.from('bank_transactions').update({ is_reconciled: true }).eq('id', id)
    toast.success('Marked as reconciled'); load()
  }

  const totalBalance   = accounts.reduce((s, a) => s + a.current_balance, 0)
  const unreconciled   = transactions.filter(t => !t.is_reconciled)
  const visibleTxns    = selectedAccount ? transactions.filter(t => t.bank_account_id === selectedAccount) : transactions

  const updAcc = (k: string, v: string) => setAccForm(p => ({ ...p, [k]: v }))
  const updTxn = (k: string, v: string) => setTxnForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Banking</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bank accounts & reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} />Sync</button>
          <button className="btn-secondary" onClick={() => setShowAddTxn(true)}><Plus size={15} />Add Transaction</button>
          <button className="btn-primary" onClick={() => setShowAddAccount(true)}><Plus size={16} />Add Account</button>
        </div>
      </div>

      {accounts.length === 0 && !loading ? (
        <div className="card p-12 flex flex-col items-center text-center gap-3 text-slate-400">
          <Landmark size={36} className="opacity-40" />
          <div>
            <p className="font-medium text-slate-700">No bank accounts yet</p>
            <p className="text-sm mt-1">Click "Add Account" to connect your bank accounts.</p>
          </div>
          <button className="btn-primary mt-2" onClick={() => setShowAddAccount(true)}><Plus size={15} />Add Bank Account</button>
        </div>
      ) : (
        <>
          {/* Account Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? Array(2).fill(0).map((_, i) => <div key={i} className="card h-32 skeleton" />) :
              accounts.map(a => (
                <button key={a.id} onClick={() => setSelectedAccount(a.id)}
                  className={`card p-5 text-left transition-all ${selectedAccount === a.id ? 'ring-2 ring-brand-500' : 'hover:shadow-md'}`}
                  style={{ background: 'linear-gradient(135deg, #0c4a6e, #0369a1)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} className="text-blue-200" />
                      <span className="text-blue-200 text-xs">{a.bank_name}</span>
                    </div>
                    <span className="text-blue-200 text-xs font-mono">{a.account_number || '—'}</span>
                  </div>
                  <p className="text-white text-2xl font-bold">{formatCurrency(a.current_balance, a.currency || currency)}</p>
                  <p className="text-blue-200 text-sm mt-1">{a.account_name}</p>
                  <span className="text-blue-300 text-xs capitalize">{a.account_type}</span>
                </button>
              ))
            }
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center"><CreditCard size={16} className="text-brand-600" /></div>
              <div><p className="text-xs text-slate-500">Total Balance</p><p className="font-bold text-slate-900">{formatCurrency(totalBalance, currency)}</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><Clock size={16} className="text-amber-600" /></div>
              <div><p className="text-xs text-slate-500">Unreconciled</p><p className="font-bold text-slate-900">{unreconciled.length} items</p></div>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center"><CheckCircle2 size={16} className="text-green-600" /></div>
              <div><p className="text-xs text-slate-500">Reconciled</p><p className="font-bold text-slate-900">{transactions.filter(t => t.is_reconciled).length} items</p></div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {selectedAccount ? `${accounts.find(a => a.id === selectedAccount)?.account_name} — Transactions` : 'All Transactions'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{visibleTxns.length} entries</span>
              </div>
            </div>
            {visibleTxns.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <p className="text-sm">No transactions yet for this account.</p>
                <button className="btn-secondary text-xs mt-3" onClick={() => setShowAddTxn(true)}><Plus size={12} />Add Transaction</button>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Account</th><th>Ref</th><th className="text-right">Amount</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {visibleTxns.map(tx => (
                    <tr key={tx.id}>
                      <td className="text-xs text-slate-500">{formatDate(tx.date)}</td>
                      <td className="font-medium text-slate-800">{tx.description}</td>
                      <td className="text-xs text-slate-500">{(tx.bank_account as any)?.bank_name}</td>
                      <td className="text-xs text-slate-400 font-mono">{tx.reference || '—'}</td>
                      <td className={`text-right font-mono text-sm font-semibold flex items-center justify-end gap-1 ${tx.type === 'credit' ? 'text-success-600' : 'text-slate-900'}`}>
                        {tx.type === 'credit'
                          ? <ArrowDownLeft size={13} className="text-success-500" />
                          : <ArrowUpRight size={13} className="text-slate-400" />}
                        {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount, currency)}
                      </td>
                      <td>
                        {tx.is_reconciled
                          ? <span className="badge bg-green-100 text-green-700 flex items-center gap-1 w-fit"><CheckCircle2 size={10} />Reconciled</span>
                          : <span className="badge bg-amber-100 text-amber-700">Pending</span>}
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

      {/* Add Bank Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Add Bank Account</h2>
              <button onClick={() => setShowAddAccount(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Bank Name *</label>
                  <input className="input" placeholder="KCB, Equity, NCBA…" value={accForm.bank_name} onChange={e => updAcc('bank_name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Account Type</label>
                  <select className="input" value={accForm.account_type} onChange={e => updAcc('account_type', e.target.value)}>
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="mpesa">M-Pesa / Mobile</option>
                    <option value="loan">Loan Account</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="input-label">Account Name *</label>
                  <input className="input" placeholder="Business Current — KES" value={accForm.account_name} onChange={e => updAcc('account_name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Account Number</label>
                  <input className="input font-mono" placeholder="1234567890" value={accForm.account_number} onChange={e => updAcc('account_number', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Opening Balance ({currency})</label>
                  <input type="number" className="input" placeholder="0.00" value={accForm.current_balance} onChange={e => updAcc('current_balance', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowAddAccount(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveAccount} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Saving...' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Bank Transaction Modal */}
      {showAddTxn && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">Record Bank Transaction</h2>
              <button onClick={() => setShowAddTxn(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="input-label">Bank Account *</label>
                <select className="input" value={txnForm.bank_account_id} onChange={e => updTxn('bank_account_id', e.target.value)}>
                  <option value="">Select account...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Date *</label>
                  <input type="date" className="input" value={txnForm.date} onChange={e => updTxn('date', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Type</label>
                  <select className="input" value={txnForm.type} onChange={e => updTxn('type', e.target.value)}>
                    <option value="credit">Credit (Money In)</option>
                    <option value="debit">Debit (Money Out)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="input-label">Description *</label>
                <input className="input" placeholder="e.g. Client payment received" value={txnForm.description} onChange={e => updTxn('description', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Amount ({currency}) *</label>
                  <input type="number" min="0" className="input" placeholder="0.00" value={txnForm.amount} onChange={e => updTxn('amount', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Reference</label>
                  <input className="input font-mono" placeholder="Cheque / ref no." value={txnForm.reference} onChange={e => updTxn('reference', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowAddTxn(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveTxn} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Saving...' : 'Record Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
