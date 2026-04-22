'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Calculator, Shield, AlertTriangle, CheckCircle2, Clock, Zap, FileX } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TaxPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [taxes, setTaxes]       = useState<any[]>([])
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const { data: txs } = await supabase.from('tax_transactions')
      .select('*, tax_policy:tax_policies(name, type, rate)')
      .eq('organization_id', organization!.id).order('created_at', { ascending:false })
    setTaxes(txs || [])
    const { data: pols } = await supabase.from('tax_policies').select('*')
      .eq('organization_id', organization!.id).eq('is_active', true)
    setPolicies(pols || [])
    setLoading(false)
  }

  const pending  = taxes.filter(t=>t.status==='pending')
  const remitted = taxes.filter(t=>t.status==='remitted')
  const totalPending  = pending.reduce((s,t)=>s+t.tax_amount,0)
  const totalRemitted = remitted.reduce((s,t)=>s+t.tax_amount,0)
  const selectedTotal = taxes.filter(t=>selected.includes(t.id)).reduce((s,t)=>s+t.tax_amount,0)

  const toggleSelect = (id:string) =>
    setSelected(p=>p.includes(id)?p.filter(s=>s!==id):[...p,id])

  const approveRemit = async () => {
    if (!selected.length) return
    const { error } = await supabase.from('tax_transactions')
      .update({ status:'remitted', remitted_at:new Date().toISOString() }).in('id', selected)
    if (error) { toast.error('Failed to remit'); return }
    toast.success(`${selected.length} item(s) remitted`); setSelected([]); load()
  }

  const TYPE_COLORS: Record<string,string> = {
    vat:'#e8f0fe;#1557b0', paye:'#f0eeff;#5b4dd1', nhif:'#e6f4ea;#137333',
    nssf:'#fef7e0;#b06000', corporate:'#fce8e6;#c5221f', withholding:'#f1f3f4;#5f6368',
  }
  const typeBadge = (type:string) => {
    const c = TYPE_COLORS[type]?.split(';') || ['#f1f3f4','#5f6368']
    return { background:c[0], color:c[1] }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Tax & Compliance</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>
            {organization?.country||'Kenya'} — Policy-aware tax management
          </p>
        </div>
        {selected.length>0 && (
          <button onClick={approveRemit} className="btn-primary flex-shrink-0 text-xs sm:text-sm">
            <CheckCircle2 size={14}/>
            <span className="hidden sm:inline">Approve & Remit ({formatCurrency(selectedTotal,currency)})</span>
            <span className="sm:hidden">Remit</span>
          </button>
        )}
      </div>

      {/* Stats — 2×2 on mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} style={{ color:'var(--warning)' }}/>
            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>Pending</span>
          </div>
          {loading?<div className="skeleton h-6 rounded w-24"/>
            :<p className="text-base sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>{formatCurrency(totalPending,currency)}</p>}
          <p className="text-xs mt-1" style={{ color:'var(--warning)' }}>{pending.length} items</p>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle2 size={13} style={{ color:'var(--success)' }}/>
            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>Remitted</span>
          </div>
          {loading?<div className="skeleton h-6 rounded w-24"/>
            :<p className="text-base sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>{formatCurrency(totalRemitted,currency)}</p>}
          <p className="text-xs mt-1" style={{ color:'var(--success)' }}>{remitted.length} total</p>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Shield size={13} style={{ color:'var(--brand)' }}/>
            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>Active Policies</span>
          </div>
          <p className="text-base sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>{policies.length}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Zap size={13} style={{ color:'var(--purple)' }}/>
            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>Auto-Remit</span>
          </div>
          <p className="text-base sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Off</p>
          <p className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>Manual only</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
        style={{ background:'var(--brand-dim)', border:'1px solid var(--brand)40' }}>
        <Zap size={14} style={{ color:'var(--brand)' }} className="flex-shrink-0 mt-0.5"/>
        <p className="text-xs sm:text-sm" style={{ color:'var(--text-primary)' }}>
          Tax is <strong>never auto-remitted</strong>. Select items below and click Approve & Remit.
        </p>
      </div>

      {/* Tax Obligations */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom:'1px solid var(--border)' }}>
          <h3 className="font-semibold text-sm" style={{ color:'var(--text-primary)' }}>Tax Obligations</h3>
          {selected.length>0 && (
            <p className="text-xs" style={{ color:'var(--brand)' }}>{selected.length} selected · {formatCurrency(selectedTotal,currency)}</p>
          )}
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background:'var(--brand)', animationDelay:`${i*0.15}s`}}/>)}</div>
          </div>
        ) : taxes.length===0 ? (
          <div className="p-10 flex flex-col items-center text-center gap-3" style={{ color:'var(--text-muted)' }}>
            <FileX size={32} style={{ opacity:0.4 }}/>
            <div>
              <p className="font-semibold text-sm" style={{ color:'var(--text-secondary)' }}>No tax records yet</p>
              <p className="text-xs mt-1">Tax transactions are created automatically when you run payroll or record VAT invoices.</p>
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width:'36px' }}>
                    <input type="checkbox" onChange={e=>setSelected(e.target.checked?pending.map(p=>p.id):[])}/>
                  </th>
                  <th>Tax Item</th>
                  <th>Type</th>
                  <th className="hidden md:table-cell">Period</th>
                  <th className="hidden sm:table-cell">Due</th>
                  <th className="text-right hidden sm:table-cell">Taxable</th>
                  <th className="text-right">Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {taxes.map(item=>(
                  <tr key={item.id} style={{ background:selected.includes(item.id)?'var(--brand-dim)':'' }}>
                    <td>{item.status==='pending'&&<input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggleSelect(item.id)}/>}</td>
                    <td className="font-medium text-sm">{item.tax_policy?.name||'Tax Item'}</td>
                    <td>
                      <span className="badge text-xs uppercase" style={typeBadge(item.tax_policy?.type||'')}>
                        {item.tax_policy?.type||'—'}
                      </span>
                    </td>
                    <td className="text-xs hidden md:table-cell" style={{ color:'var(--text-muted)' }}>
                      {item.period_start?`${item.period_start} → ${item.period_end}`:'—'}
                    </td>
                    <td className="text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>
                      {item.due_date?formatDate(item.due_date):'—'}
                    </td>
                    <td className="text-right font-mono text-xs hidden sm:table-cell">{formatCurrency(item.taxable_amount,currency)}</td>
                    <td className="text-right font-mono text-sm font-bold">{formatCurrency(item.tax_amount,currency)}</td>
                    <td>
                      <span className="badge text-xs" style={{
                        background: item.status==='remitted'?'var(--success-dim)':item.status==='overdue'?'var(--danger-dim)':'var(--warning-dim)',
                        color: item.status==='remitted'?'var(--success)':item.status==='overdue'?'var(--danger)':'var(--warning)',
                      }}>{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active policies */}
      {policies.length>0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-sm mb-3" style={{ color:'var(--text-primary)' }}>Active Tax Policies</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {policies.map(p=>(
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background:'var(--bg-table-head)' }}>
                <span className="text-sm" style={{ color:'var(--text-secondary)' }}>{p.name}</span>
                <span className="font-bold text-sm" style={{ color:'var(--text-primary)' }}>{p.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
