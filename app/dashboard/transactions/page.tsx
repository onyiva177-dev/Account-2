'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils'
import { Plus, Search, Filter, Eye, FileText, TrendingUp, Clock, AlertCircle, X, CheckCircle2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = ['Invoices', 'Bills', 'Expenses', 'Payments']
const TYPES: Record<number, string[]> = {
  0: ['invoice'], 1: ['bill'], 2: ['expense'], 3: ['payment', 'receipt']
}
const TAX_RATE = 0.16

export default function TransactionsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [tab, setTab] = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [contacts, setContacts] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [viewTx, setViewTx] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const currency = organization?.base_currency || 'KES'

  const [form, setForm] = useState({
    contact_id: '', date: new Date().toISOString().split('T')[0],
    due_date: '', notes: '',
    lines: [{ description: '', quantity: '1', unit_price: '', tax_rate: '0', account_id: '' }]
  })

  useEffect(() => {
    if (!organization) return
    load()
    loadMeta()
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

  const loadMeta = async () => {
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('contacts').select('id, name, type').eq('organization_id', organization!.id).eq('is_active', true).order('name'),
      supabase.from('accounts').select('id, code, name, account_type:account_types(category)').eq('organization_id', organization!.id).eq('is_active', true).order('code'),
    ])
    setContacts(c || [])
    setAccounts(a || [])
  }

  const resetForm = () => setForm({
    contact_id: '', date: new Date().toISOString().split('T')[0], due_date: '', notes: '',
    lines: [{ description: '', quantity: '1', unit_price: '', tax_rate: '0', account_id: '' }]
  })

  const addLine = () => setForm(p => ({ ...p, lines: [...p.lines, { description: '', quantity: '1', unit_price: '', tax_rate: '0', account_id: '' }] }))
  const removeLine = (i: number) => setForm(p => ({ ...p, lines: p.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i: number, k: string, v: string) => {
    const lines = [...form.lines]; lines[i] = { ...lines[i], [k]: v }
    setForm(p => ({ ...p, lines }))
  }

  const subtotal   = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const taxAmount  = form.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0) * ((Number(l.tax_rate) || 0) / 100), 0)
  const total      = subtotal + taxAmount

  // Auto-generate transaction number
  const genNumber = (type: string) => {
    const prefixes: Record<string, string> = { invoice: 'INV', bill: 'BILL', expense: 'EXP', payment: 'PAY' }
    const prefix = prefixes[type] || 'TXN'
    return `${prefix}-${Date.now().toString().slice(-6)}`
  }

  const saveTransaction = async (status: 'draft' | 'sent') => {
    if (!form.contact_id && tab < 2) { toast.error('Select a contact'); return }
    if (form.lines.every(l => !l.unit_price)) { toast.error('Add at least one line item'); return }
    setSaving(true)

    const type = TYPES[tab][0]
    const { data: tx, error } = await supabase.from('transactions').insert({
      organization_id: organization!.id,
      contact_id:      form.contact_id || null,
      type,
      number:          genNumber(type),
      date:            form.date,
      due_date:        form.due_date || null,
      status,
      subtotal,
      tax_amount:      taxAmount,
      total,
      amount_paid:     0,
      balance_due:     total,
      currency,
      notes:           form.notes,
    }).select().single()

    if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }

    const validLines = form.lines.filter(l => l.unit_price)
    if (validLines.length > 0) {
      await supabase.from('transaction_lines').insert(
        validLines.map((l, i) => ({
          transaction_id: tx.id,
          description:    l.description,
          quantity:       Number(l.quantity) || 1,
          unit_price:     Number(l.unit_price) || 0,
          tax_rate:       Number(l.tax_rate) || 0,
          tax_amount:     (Number(l.quantity)||0) * (Number(l.unit_price)||0) * ((Number(l.tax_rate)||0)/100),
          total:          (Number(l.quantity)||0) * (Number(l.unit_price)||0) * (1 + (Number(l.tax_rate)||0)/100),
          account_id:     l.account_id || null,
          line_number:    i + 1,
        }))
      )
    }

    toast.success(`${TABS[tab].slice(0,-1)} ${status === 'sent' ? 'sent' : 'saved as draft'}`)
    setShowNew(false); resetForm(); load()
    setSaving(false)
  }

  const markPaid = async (id: string, total: number) => {
    await supabase.from('transactions').update({ status: 'paid', amount_paid: total, balance_due: 0 }).eq('id', id)
    toast.success('Marked as paid'); load()
  }

  const voidTx = async (id: string) => {
    await supabase.from('transactions').update({ status: 'voided' }).eq('id', id)
    toast.success('Voided'); load()
  }

  const stats = {
    total:       transactions.reduce((s, t) => s + t.total, 0),
    paid:        transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.total, 0),
    outstanding: transactions.filter(t => ['sent','partial','overdue'].includes(t.status)).reduce((s, t) => s + t.balance_due, 0),
    overdue:     transactions.filter(t => t.status === 'overdue').length,
  }

  const filtered = transactions.filter(t =>
    !search || t.number?.toLowerCase().includes(search.toLowerCase()) ||
    (t.contact as any)?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const typeLabel = TABS[tab].slice(0, -1) // Invoice, Bill, Expense, Payment

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Invoices, bills, expenses & payments</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowNew(true) }}>
          <Plus size={16} />New {typeLabel}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: formatCurrency(stats.total, currency), icon: FileText, color: 'text-brand-600 bg-brand-50' },
          { label: 'Paid',  value: formatCurrency(stats.paid, currency),  icon: TrendingUp, color: 'text-success-600 bg-green-50' },
          { label: 'Outstanding', value: formatCurrency(stats.outstanding, currency), icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Overdue', value: `${stats.overdue} items`, icon: AlertCircle, color: 'text-danger-500 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={16} /></div>
            <div><p className="text-xs text-slate-500">{s.label}</p><p className="font-bold text-slate-900 text-sm">{s.value}</p></div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Number</th><th>Contact</th><th>Date</th><th>Due Date</th>
              <th className="text-right">Total</th><th className="text-right">Balance Due</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-400">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No {TABS[tab].toLowerCase()} yet. Click "New {typeLabel}" to create one.</p>
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
                <td>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost p-1.5" onClick={() => setViewTx(tx)} title="View"><Eye size={14} /></button>
                    {tx.status !== 'paid' && tx.status !== 'voided' && (
                      <button className="btn-ghost p-1.5 text-success-600 hover:bg-green-50" onClick={() => markPaid(tx.id, tx.total)} title="Mark paid">
                        <CheckCircle2 size={14} />
                      </button>
                    )}
                    {tx.status !== 'voided' && (
                      <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => voidTx(tx.id)} title="Void">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Transaction Modal */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">{viewTx.number}</h2>
                <p className="text-xs text-slate-500">{formatDate(viewTx.date)} · {(viewTx.contact as any)?.name || 'No contact'}</p>
              </div>
              <button onClick={() => setViewTx(null)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-slate-500">Status</p><span className={`badge ${getStatusColor(viewTx.status)}`}>{viewTx.status}</span></div>
                <div><p className="text-xs text-slate-500">Due Date</p><p className="font-medium">{viewTx.due_date ? formatDate(viewTx.due_date) : '—'}</p></div>
                <div><p className="text-xs text-slate-500">Currency</p><p className="font-medium">{viewTx.currency}</p></div>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-4 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-2">Description</div><div className="text-right">Qty × Price</div><div className="text-right">Total</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {[{ description: 'See details in database', quantity: 1, unit_price: viewTx.subtotal, total: viewTx.subtotal }].map((l, i) => (
                    <div key={i} className="grid grid-cols-4 px-4 py-2.5 text-sm">
                      <div className="col-span-2 text-slate-700">{l.description}</div>
                      <div className="text-right text-slate-500">{l.quantity} × {formatCurrency(l.unit_price, currency)}</div>
                      <div className="text-right font-semibold">{formatCurrency(l.total, currency)}</div>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100 bg-slate-50 text-sm">
                  <div className="flex justify-between px-4 py-2"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(viewTx.subtotal, currency)}</span></div>
                  <div className="flex justify-between px-4 py-2"><span className="text-slate-500">Tax</span><span>{formatCurrency(viewTx.tax_amount, currency)}</span></div>
                  <div className="flex justify-between px-4 py-2 font-bold text-base"><span>Total</span><span>{formatCurrency(viewTx.total, currency)}</span></div>
                  {viewTx.balance_due > 0 && (
                    <div className="flex justify-between px-4 py-2 font-semibold text-amber-600"><span>Balance Due</span><span>{formatCurrency(viewTx.balance_due, currency)}</span></div>
                  )}
                </div>
              </div>
              {viewTx.notes && <p className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">{viewTx.notes}</p>}
            </div>
            <div className="flex justify-between px-6 py-4 border-t border-slate-100">
              <button onClick={() => setViewTx(null)} className="btn-secondary">Close</button>
              {viewTx.status !== 'paid' && viewTx.status !== 'voided' && (
                <button className="btn-primary" onClick={() => { markPaid(viewTx.id, viewTx.total); setViewTx(null) }}>
                  <CheckCircle2 size={15} />Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Transaction Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">New {typeLabel}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Fill in the details below</p>
              </div>
              <button onClick={() => setShowNew(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header */}
              <div className="grid grid-cols-3 gap-4">
                {tab < 2 && (
                  <div>
                    <label className="input-label">{tab === 0 ? 'Customer' : 'Vendor'} *</label>
                    <select className="input" value={form.contact_id} onChange={e => setForm(p => ({ ...p, contact_id: e.target.value }))}>
                      <option value="">Select contact...</option>
                      {contacts
                        .filter(c => tab === 0 ? ['customer','both'].includes(c.type) : ['vendor','both','supplier'].includes(c.type))
                        .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="input-label">Date *</label>
                  <input type="date" className="input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                </div>
                {tab === 0 && (
                  <div>
                    <label className="input-label">Due Date</label>
                    <input type="date" className="input" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="input-label mb-0">Line Items</label>
                  <button onClick={addLine} className="btn-ghost text-xs text-brand-600"><Plus size={12} />Add line</button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-1">
                    <div className="col-span-4 text-xs text-slate-400 font-medium">Description</div>
                    <div className="col-span-2 text-xs text-slate-400 font-medium">Qty</div>
                    <div className="col-span-2 text-xs text-slate-400 font-medium">Price</div>
                    <div className="col-span-2 text-xs text-slate-400 font-medium">Tax %</div>
                    <div className="col-span-1 text-xs text-slate-400 font-medium text-right">Total</div>
                  </div>
                  {form.lines.map((line, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <input className="input text-xs" placeholder="Description" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" className="input text-xs text-right" value={line.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="0" className="input text-xs text-right" placeholder="0.00" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <select className="input text-xs" value={line.tax_rate} onChange={e => updateLine(i, 'tax_rate', e.target.value)}>
                          <option value="0">0%</option>
                          <option value="16">16% VAT</option>
                          <option value="8">8% (Exempt)</option>
                        </select>
                      </div>
                      <div className="col-span-1 text-right text-xs font-semibold text-slate-700">
                        {formatCurrency((Number(line.quantity)||0) * (Number(line.unit_price)||0) * (1 + (Number(line.tax_rate)||0)/100), currency)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeLine(i)} className="w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center"><X size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                <div className="mt-3 pt-3 border-t border-slate-200 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal, currency)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>Tax</span><span className="font-mono">{formatCurrency(taxAmount, currency)}</span></div>
                  <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2"><span>Total</span><span className="font-mono text-brand-700">{formatCurrency(total, currency)}</span></div>
                </div>
              </div>

              <div>
                <label className="input-label">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="Internal notes..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowNew(false)} className="btn-secondary">Cancel</button>
              <div className="flex gap-2">
                <button onClick={() => saveTransaction('draft')} disabled={saving} className="btn-secondary">Save Draft</button>
                <button onClick={() => saveTransaction('sent')} disabled={saving} className="btn-primary">
                  <CheckCircle2 size={15} />{saving ? 'Saving...' : tab === 0 ? 'Send Invoice' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
