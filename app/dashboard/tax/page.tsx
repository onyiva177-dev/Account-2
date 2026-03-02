'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Calculator, Shield, AlertTriangle, CheckCircle2, Clock, Calendar, ChevronRight, Zap } from 'lucide-react'

const TAX_ITEMS = [
  { id: '1', name: 'VAT Return — February 2026', type: 'vat', amount: 84320, due: '2026-03-10', status: 'pending', period: 'Feb 2026' },
  { id: '2', name: 'PAYE — February 2026', type: 'paye', amount: 142000, due: '2026-03-09', status: 'pending', period: 'Feb 2026' },
  { id: '3', name: 'NHIF Contribution — February 2026', type: 'nhif', amount: 28600, due: '2026-03-09', status: 'pending', period: 'Feb 2026' },
  { id: '4', name: 'NSSF Contribution — February 2026', type: 'nssf', amount: 12400, due: '2026-03-15', status: 'pending', period: 'Feb 2026' },
  { id: '5', name: 'VAT Return — January 2026', type: 'vat', amount: 71280, due: '2026-02-10', status: 'remitted', period: 'Jan 2026' },
  { id: '6', name: 'PAYE — January 2026', type: 'paye', amount: 138500, due: '2026-02-09', status: 'remitted', period: 'Jan 2026' },
  { id: '7', name: 'Corporate Tax Q1 2025', type: 'corporate', amount: 320000, due: '2026-04-30', status: 'upcoming', period: 'Q1 2026' },
]

const TYPE_COLORS: Record<string, string> = {
  vat: 'badge bg-blue-100 text-blue-700',
  paye: 'badge bg-purple-100 text-purple-700',
  nhif: 'badge bg-green-100 text-green-700',
  nssf: 'badge bg-amber-100 text-amber-700',
  corporate: 'badge bg-red-100 text-red-700',
  withholding: 'badge bg-slate-100 text-slate-700',
}

export default function TaxPage() {
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [selected, setSelected] = useState<string[]>([])

  const pending = TAX_ITEMS.filter(t => t.status === 'pending')
  const total_pending = pending.reduce((s, t) => s + t.amount, 0)

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const totalSelected = TAX_ITEMS.filter(t => selected.includes(t.id)).reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tax & Compliance</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kenya — Policy-aware tax management</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Zap size={15} />Run Tax Calc</button>
          {selected.length > 0 && (
            <button className="btn-primary">
              <CheckCircle2 size={15} />
              Approve & Remit ({formatCurrency(totalSelected, currency)})
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Pending Remittance</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(total_pending, currency)}</p>
          <p className="text-xs text-amber-600 mt-1">{pending.length} items due</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-success-500" />
            <span className="text-xs font-medium text-slate-500">Remitted (YTD)</span>
          </div>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(209780, currency)}</p>
          <p className="text-xs text-success-600 mt-1">2 transactions</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={16} className="text-brand-500" />
            <span className="text-xs font-medium text-slate-500">Next Due Date</span>
          </div>
          <p className="text-xl font-bold text-slate-900">9 Mar</p>
          <p className="text-xs text-brand-600 mt-1">PAYE & NHIF/NSSF</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-purple-500" />
            <span className="text-xs font-medium text-slate-500">Compliance Score</span>
          </div>
          <p className="text-xl font-bold text-slate-900">94%</p>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
            <div className="bg-success-500 h-1.5 rounded-full" style={{ width: '94%' }} />
          </div>
        </div>
      </div>

      {/* AI Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Zap size={15} className="text-brand-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">AI Tax Notice</p>
          <p className="text-sm text-slate-600 mt-0.5">
            Your VAT of <strong>{formatCurrency(84320, currency)}</strong> for February 2026 is calculated and ready for review.
            Tax is <strong>NOT auto-remitted</strong> — please review and approve manually before payment.
          </p>
        </div>
      </div>

      {/* Tax Transactions Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Tax Obligations</h3>
          {selected.length > 0 && (
            <p className="text-sm text-brand-600">{selected.length} selected · {formatCurrency(totalSelected, currency)}</p>
          )}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th className="w-10"><input type="checkbox" className="rounded" onChange={e => setSelected(e.target.checked ? pending.map(p => p.id) : [])} /></th>
              <th>Tax Item</th>
              <th>Type</th>
              <th>Period</th>
              <th>Due Date</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {TAX_ITEMS.map(item => (
              <tr key={item.id} className={selected.includes(item.id) ? 'bg-brand-50/50' : ''}>
                <td>
                  {item.status === 'pending' && (
                    <input type="checkbox" className="rounded" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                  )}
                </td>
                <td className="font-medium text-slate-800">{item.name}</td>
                <td><span className={TYPE_COLORS[item.type] || 'badge bg-gray-100 text-gray-600'}>{item.type.toUpperCase()}</span></td>
                <td className="text-slate-500 text-xs">{item.period}</td>
                <td className="text-xs">
                  <span className={`flex items-center gap-1 ${item.status === 'pending' && new Date(item.due) <= new Date() ? 'text-danger-500' : 'text-slate-500'}`}>
                    <Clock size={11} />
                    {formatDate(item.due)}
                  </span>
                </td>
                <td className="text-right font-mono font-semibold text-sm">{formatCurrency(item.amount, currency)}</td>
                <td>
                  <span className={`badge ${
                    item.status === 'remitted' ? 'bg-green-100 text-green-700' :
                    item.status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>{item.status}</span>
                </td>
                <td>
                  <button className="btn-ghost p-1.5 text-xs text-brand-600">
                    <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Rates Config */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Kenya Tax Rates (Active Policy)</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          {[
            { label: 'VAT (Standard)', rate: '16%', status: 'active' },
            { label: 'VAT (Zero-rated)', rate: '0%', status: 'active' },
            { label: 'Corporate Tax', rate: '30%', status: 'active' },
            { label: 'PAYE (Max bracket)', rate: '30%', status: 'active' },
            { label: 'NHIF (Max)', rate: 'KES 1,700/mo', status: 'active' },
            { label: 'NSSF (Tier II)', rate: '6%', status: 'active' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-slate-700">{r.label}</span>
              <span className="font-semibold text-slate-900">{r.rate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
