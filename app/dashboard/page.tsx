'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, Search, Filter, Eye, FileText, TrendingUp, Clock, AlertCircle, X, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = ['Invoices','Bills','Expenses','Payments']
const TYPES: Record<number,string[]> = { 0:['invoice'],1:['bill'],2:['expense'],3:['payment','receipt'] }

export default function TransactionsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [tab, setTab] = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewTx, setViewTx] = useState<any>(null)
  const currency = organization?.base_currency || 'KES'

  useEffect(() => { if (organization) load() }, [organization, tab])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('transactions').select('*, contact:contacts(name)')
      .eq('organization_id', organization!.id).in('type', TYPES[tab])
      .order('date', { ascending: false }).limit(50)
    setTransactions(data || [])
    setLoading(false)
  }

  const markPaid = async (id: string, total: number) => {
    await supabase.from('transactions').update({ status: 'paid', amount_paid: total, balance_due: 0 }).eq('id', id)
    toast.success('Marked as paid'); setViewTx(null); load()
  }

  const stats = {
    total: transactions.reduce((s,t) => s+t.total, 0),
    paid: transactions.filter(t=>t.status==='paid').reduce((s,t)=>s+t.total,0),
    outstanding: transactions.filter(t=>['sent','partial','overdue'].includes(t.status)).reduce((s,t)=>s+t.balance_due,0),
    overdue: transactions.filter(t=>t.status==='overdue').length,
  }
  const filtered = transactions.filter(t => !search ||
    t.number?.toLowerCase().includes(search.toLowerCase()) ||
    (t.contact as any)?.name?.toLowerCase().includes(search.toLowerCase()))

  const V = (bg:string, col:string) => ({ background: bg, color: col })

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Transactions</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>Invoices, bills, expenses & payments</p>
        </div>
        <button className="btn-primary flex-shrink-0">
          <Plus size={15}/><span className="hidden sm:inline">New </span>{TABS[tab].slice(0,-1)}
        </button>
      </div>

      {/* Stats 2-col mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total',       val:formatCurrency(stats.total,currency),       icon:FileText,     ...V('var(--brand-dim)','var(--brand)') },
          { label:'Paid',        val:formatCurrency(stats.paid,currency),        icon:TrendingUp,   ...V('var(--success-dim)','var(--success)') },
          { label:'Outstanding', val:formatCurrency(stats.outstanding,currency), icon:Clock,        ...V('var(--warning-dim)','var(--warning)') },
          { label:'Overdue',     val:`${stats.overdue} items`,                   icon:AlertCircle,  ...V('var(--danger-dim)','var(--danger)') },
        ].map(s => (
          <div key={s.label} className="card p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:s.background }}>
              <s.icon size={14} style={{ color:s.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{s.label}</p>
              <p className="font-bold text-xs sm:text-sm truncate" style={{ color:'var(--text-primary)' }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs — scrollable */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl w-max" style={{ background:'var(--bg-table-head)' }}>
          {TABS.map((t,i) => (
            <button key={t} onClick={()=>setTab(i)}
              className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: tab===i ? 'var(--bg-card)' : 'transparent',
                color: tab===i ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: tab===i ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }} />
          <input className="input pl-8 text-sm" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <button className="btn-secondary px-3 text-sm"><Filter size={14}/><span className="hidden sm:inline">Filter</span></button>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Contact</th>
                <th className="hidden sm:table-cell">Date</th>
                <th className="text-right">Total</th>
                <th className="hidden md:table-cell text-right">Balance</th>
                <th>Status</th>
                <th style={{ width:'48px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_,i) => (
                <tr key={i}>{Array(7).fill(0).map((_,j)=><td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color:'var(--text-muted)' }}>
                  <FileText size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No {TABS[tab].toLowerCase()} yet</p>
                </td></tr>
              ) : filtered.map(tx => (
                <tr key={tx.id}>
                  <td className="font-mono text-xs font-bold" style={{ color:'var(--brand)' }}>{tx.number}</td>
                  <td className="max-w-24 sm:max-w-none truncate text-sm font-medium">{(tx.contact as any)?.name||'—'}</td>
                  <td className="text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>{formatDate(tx.date)}</td>
                  <td className="text-right font-mono text-sm font-bold">{formatCurrency(tx.total,currency)}</td>
                  <td className="text-right font-mono text-xs hidden md:table-cell"
                    style={{ color:tx.balance_due>0?'var(--warning)':'var(--text-muted)' }}>
                    {formatCurrency(tx.balance_due,currency)}
                  </td>
                  <td>
                    <span className="badge text-xs" style={{
                      background: tx.status==='paid'?'var(--success-dim)':tx.status==='overdue'?'var(--danger-dim)':'var(--warning-dim)',
                      color: tx.status==='paid'?'var(--success)':tx.status==='overdue'?'var(--danger)':'var(--warning)',
                    }}>{tx.status}</span>
                  </td>
                  <td><button className="btn-ghost p-1.5" onClick={()=>setViewTx(tx)}><Eye size={13}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal — slides up from bottom on mobile */}
      {viewTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(32,33,36,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setViewTx(null)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <div>
                <p className="font-bold" style={{ color:'var(--text-primary)' }}>{viewTx.number}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
                  {formatDate(viewTx.date)} · {(viewTx.contact as any)?.name||'No contact'}
                </p>
              </div>
              <button className="btn-ghost p-2" onClick={()=>setViewTx(null)}><X size={16}/></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {[['Type',viewTx.type],['Subtotal',formatCurrency(viewTx.subtotal,currency)],
                ['Tax',formatCurrency(viewTx.tax_amount,currency)],['Total',formatCurrency(viewTx.total,currency)],
                ['Balance Due',formatCurrency(viewTx.balance_due,currency)]
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between py-2" style={{ borderBottom:'1px solid var(--border-light)' }}>
                  <span className="text-sm" style={{ color:'var(--text-secondary)' }}>{k}</span>
                  <span className="text-sm font-semibold" style={{ color:'var(--text-primary)' }}>{v}</span>
                </div>
              ))}
            </div>
            {viewTx.status!=='paid'&&viewTx.status!=='voided'&&(
              <div className="p-4" style={{ borderTop:'1px solid var(--border)' }}>
                <button className="btn-primary w-full justify-center" onClick={()=>markPaid(viewTx.id,viewTx.total)}>
                  <CheckCircle2 size={15}/>Mark as Paid
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
