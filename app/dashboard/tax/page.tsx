'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Calculator, Shield, AlertTriangle, CheckCircle2, Clock, Calendar, ChevronRight, Zap, FileX } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TaxPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [taxes, setTaxes] = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: txs } = await supabase
      .from('tax_transactions')
      .select('*, tax_policy:tax_policies(name, type, rate)')
      .eq('organization_id', organization!.id)
      .order('created_at', { ascending: false })
    setTaxes(txs || [])

    const { data: pols } = await supabase
      .from('tax_policies')
      .select('*')
      .eq('organization_id', organization!.id)
      .eq('is_active', true)
    setPolicies(pols || [])
    setLoading(false)
  }

  const pending = taxes.filter(t => t.status === 'pending')
  const remitted = taxes.filter(t => t.status === 'remitted')
  const totalPending = pending.reduce((s, t) => s + t.tax_amount, 0)
  const totalRemitted = remitted.reduce((s, t) => s + t.tax_amount, 0)
  const selectedTotal = taxes.filter(t => selected.includes(t.id)).reduce((s, t) => s + t.tax_amount, 0)

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const approveRemit = async () => {
    if (selected.length === 0) return
    const { error } = await supabase
      .from('tax_transactions')
      .update({ status: 'remitted', remitted_at: new Date().toISOString() })
      .in('id', selected)
    if (error) { toast.error('Failed to remit'); return }
    toast.success(`${selected.length} tax item(s) marked as remitted`)
    setSelected([])
    load()
  }

  const TYPE_COLORS: Record<string, string> = {
    vat: 'badge bg-blue-100 text-blue-700',
    paye: 'badge bg-purple-100 text-purple-700',
    nhif: 'badge bg-green-100 text-green-700',
    nssf: 'badge bg-amber-100 text-amber-700',
    corporate: 'badge bg-red-100 text-red-700',
    withholding: 'badge bg-slate-100 text-slate-700',
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tax & Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">{organization?.country || 'Kenya'} — Policy-aware tax management</p>
        </div>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <button onClick={approveRemit} className="btn-primary">
              <CheckCircle2 size={15} />
              Approve & Remit ({formatCurrency(selectedTotal, currency)})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle size={16} className="text-amber-500" /><span className="text-xs font-medium text-slate-500">Pending Remittance</span></div>
          {loading ? <div className="skeleton h-7 w-28 rounded" /> : <p className="text-xl font-bold text-slate-900">{formatCurrency(totalPending, currency)}</p>}
          <p className="text-xs text-amber-600 mt-1">{pending.length} items</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 size={16} className="text-success-500" /><span className="text-xs font-medium text-slate-500">Remitted (Total)</span></div>
          {loading ? <div className="skeleton h-7 w-28 rounded" /> : <p className="text-xl font-bold text-slate-900">{formatCurrency(totalRemitted, currency)}</p>}
          <p className="text-xs text-success-600 mt-1">{remitted.length} transactions</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><Shield size={16} className="text-brand-500" /><span className="text-xs font-medium text-slate-500">Active Tax Policies</span></div>
          <p className="text-xl font-bold text-slate-900">{policies.length}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2"><Zap size={16} className="text-purple-500" /><span className="text-xs font-medium text-slate-500">Auto-Remit</span></div>
          <p className="text-xl font-bold text-slate-900">Disabled</p>
          <p className="text-xs text-slate-500 mt-1">Manual approval required</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Zap size={16} className="text-brand-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-700">
          Tax is <strong>never auto-remitted</strong>. Select items below and click "Approve & Remit" to manually process payments after review.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Tax Obligations</h3>
          {selected.length > 0 && <p className="text-sm text-brand-600">{selected.length} selected · {formatCurrency(selectedTotal, currency)}</p>}
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div></div>
        ) : taxes.length === 0 ? (
          <div className="p-12 flex flex-col items-center text-center gap-3 text-slate-400">
            <FileX size={36} className="opacity-40" />
            <div>
              <p className="font-medium text-slate-700">No tax records yet</p>
              <p className="text-sm mt-1">Tax transactions are created automatically when you run payroll or record VAT-applicable invoices.</p>
            </div>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="w-10"><input type="checkbox" className="rounded" onChange={e => setSelected(e.target.checked ? pending.map(p => p.id) : [])} /></th>
                <th>Tax Item</th><th>Type</th><th>Period</th><th>Due Date</th>
                <th className="text-right">Taxable Amount</th>
                <th className="text-right">Tax Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {taxes.map(item => (
                <tr key={item.id} className={selected.includes(item.id) ? 'bg-brand-50/50' : ''}>
                  <td>{item.status === 'pending' && <input type="checkbox" className="rounded" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />}</td>
                  <td className="font-medium text-slate-800">{item.tax_policy?.name || 'Tax Item'}</td>
                  <td><span className={TYPE_COLORS[item.tax_policy?.type] || 'badge bg-gray-100 text-gray-600'}>{(item.tax_policy?.type || 'other').toUpperCase()}</span></td>
                  <td className="text-xs text-slate-500">{item.period_start} → {item.period_end}</td>
                  <td className="text-xs">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock size={11} />{item.due_date ? formatDate(item.due_date) : '—'}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm">{formatCurrency(item.taxable_amount, currency)}</td>
                  <td className="text-right font-mono text-sm font-semibold">{formatCurrency(item.tax_amount, currency)}</td>
                  <td>
                    <span className={`badge ${item.status === 'remitted' ? 'bg-green-100 text-green-700' : item.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {policies.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Active Tax Policies</h3>
          <div className="grid grid-cols-3 gap-3">
            {policies.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                <span className="text-slate-700">{p.name}</span>
                <span className="font-semibold text-slate-900">{p.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
