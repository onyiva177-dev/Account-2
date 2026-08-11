'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  Plus, Search, Filter, Eye, FileText, TrendingUp,
  Clock, AlertCircle, X, CheckCircle2, Zap, BookOpen
} from 'lucide-react'
import toast from 'react-hot-toast'

const TABS = ['All','Invoices','Bills','Expenses','POS Sales','Payroll','Payments']
const TYPE_MAP: Record<string, string[]> = {
  'All':      [],
  'Invoices': ['invoice'],
  'Bills':    ['bill'],
  'Expenses': ['expense'],
  'POS Sales':['pos_sale'],
  'Payroll':  ['payroll'],
  'Payments': ['payment','receipt'],
}

export default function TransactionsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [tab,          setTab]          = useState('All')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [sourceFilter, setSourceFilter] = useState<'all'|'manual'|'automatic'>('all')
  const [viewTx,       setViewTx]       = useState<any>(null)

  useEffect(() => { if (organization) load() }, [organization, tab, sourceFilter])

  const load = async () => {
    setLoading(true)
    let query = supabase.from('transactions')
      .select('*, contact:contacts(name), journal_entry:journal_entries(entry_number,source_type)')
      .eq('organization_id', organization!.id)
      .order('date', { ascending:false }).limit(100)

    const types = TYPE_MAP[tab]
    if (types.length > 0) query = query.in('type', types)

    const { data } = await query
    let rows = data || []

    // Apply source filter
    if (sourceFilter === 'manual') {
      rows = rows.filter((t:any) =>
        !t.journal_entry || (t.journal_entry as any)?.source_type === 'manual'
      )
    } else if (sourceFilter === 'automatic') {
      rows = rows.filter((t:any) =>
        (t.journal_entry as any)?.source_type &&
        (t.journal_entry as any)?.source_type !== 'manual'
      )
    }
    setTransactions(rows)
    setLoading(false)
  }

  const markPaid = async (id: string, total: number) => {
    await supabase.from('transactions').update({ status:'paid', amount_paid:total, balance_due:0 }).eq('id', id)
    toast.success('Marked as paid'); setViewTx(null); load()
  }

  const stats = {
    total:       transactions.reduce((s,t)=>s+t.total,0),
    paid:        transactions.filter(t=>t.status==='paid').reduce((s,t)=>s+t.total,0),
    outstanding: transactions.filter(t=>['sent','partial','overdue'].includes(t.status)).reduce((s,t)=>s+t.balance_due,0),
    overdue:     transactions.filter(t=>t.status==='overdue').length,
    automatic:   transactions.filter(t=>(t.journal_entry as any)?.source_type && (t.journal_entry as any)?.source_type !== 'manual').length,
  }

  const filtered = transactions.filter(t =>
    !search ||
    t.number?.toLowerCase().includes(search.toLowerCase()) ||
    (t.contact as any)?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const getSourceBadge = (tx: any) => {
    const src = (tx.journal_entry as any)?.source_type
    if (!src || src === 'manual') return { label:'Manual', bg:'var(--bg-table-head)', col:'var(--text-muted)' }
    const map: Record<string,{label:string;bg:string;col:string}> = {
      payroll:  { label:'Payroll',  bg:'var(--warning-dim)',  col:'var(--warning)' },
      pos_sale: { label:'POS',      bg:'var(--success-dim)',  col:'var(--success)' },
      bank:     { label:'Bank',     bg:'var(--brand-dim)',    col:'var(--brand)' },
      tax:      { label:'Tax',      bg:'var(--danger-dim)',   col:'var(--danger)' },
      invoice:  { label:'Invoice',  bg:'var(--purple-dim)',   col:'var(--purple)' },
    }
    return map[src] || { label:src, bg:'var(--bg-table-head)', col:'var(--text-secondary)' }
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Transactions</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>
            Manual entries + auto-generated from POS, Payroll, Banking
          </p>
        </div>
        <button className="btn-primary flex-shrink-0"><Plus size={15}/>New Invoice</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Total',        val:formatCurrency(stats.total,currency),       icon:FileText,    bg:'var(--brand-dim)',   col:'var(--brand)' },
          { label:'Paid',         val:formatCurrency(stats.paid,currency),        icon:TrendingUp,  bg:'var(--success-dim)', col:'var(--success)' },
          { label:'Outstanding',  val:formatCurrency(stats.outstanding,currency), icon:Clock,       bg:'var(--warning-dim)', col:'var(--warning)' },
          { label:'Auto-generated',val:`${stats.automatic} entries`,              icon:Zap,         bg:'var(--purple-dim)',  col:'var(--purple)' },
        ].map(s=>(
          <div key={s.label} className="card p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:s.bg }}>
              <s.icon size={14} style={{ color:s.col }}/>
            </div>
            <div className="min-w-0">
              <p className="text-xs" style={{ color:'var(--text-secondary)' }}>{s.label}</p>
              <p className="font-bold text-xs sm:text-sm truncate" style={{ color:'var(--text-primary)' }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Type tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl w-max" style={{ background:'var(--bg-table-head)' }}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: tab===t ? 'var(--bg-card)' : 'transparent',
                color: tab===t ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: tab===t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Source filter + search */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
          <input className="input pl-8 text-sm" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        {/* Source type filter — the key feature for reports segregation */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'var(--bg-table-head)' }}>
          {(['all','manual','automatic'] as const).map(f=>(
            <button key={f} onClick={()=>setSourceFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
              style={{
                background: sourceFilter===f ? 'var(--bg-card)' : 'transparent',
                color: sourceFilter===f ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: sourceFilter===f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}>
              {f === 'all' ? 'All Sources' : f === 'manual' ? '✍️ Manual' : '⚡ Auto-generated'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Contact / Description</th>
                <th className="hidden sm:table-cell">Date</th>
                <th>Source</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th style={{ width:'40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(6).fill(0).map((_,i)=>(
                <tr key={i}>{Array(7).fill(0).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10" style={{ color:'var(--text-muted)' }}>
                  <FileText size={28} className="mx-auto mb-2 opacity-30"/>
                  <p className="text-sm">No transactions found</p>
                </td></tr>
              ) : filtered.map(tx => {
                const src = getSourceBadge(tx)
                return (
                  <tr key={tx.id}>
                    <td className="font-mono text-xs font-bold" style={{ color:'var(--brand)' }}>{tx.number}</td>
                    <td className="max-w-36 sm:max-w-none">
                      <p className="text-sm font-medium truncate" style={{ color:'var(--text-primary)' }}>
                        {(tx.contact as any)?.name || tx.description || '—'}
                      </p>
                      {(tx.journal_entry as any)?.entry_number && (
                        <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color:'var(--text-muted)' }}>
                          <BookOpen size={10}/>{(tx.journal_entry as any).entry_number}
                        </p>
                      )}
                    </td>
                    <td className="text-xs hidden sm:table-cell" style={{ color:'var(--text-muted)' }}>{formatDate(tx.date)}</td>
                    <td>
                      <span className="badge text-xs" style={{ background:src.bg, color:src.col }}>{src.label}</span>
                    </td>
                    <td className="text-right font-mono text-sm font-bold">{formatCurrency(tx.total,currency)}</td>
                    <td>
                      <span className="badge text-xs" style={{
                        background: tx.status==='paid'?'var(--success-dim)':tx.status==='overdue'?'var(--danger-dim)':'var(--warning-dim)',
                        color: tx.status==='paid'?'var(--success)':tx.status==='overdue'?'var(--danger)':'var(--warning)',
                      }}>{tx.status}</span>
                    </td>
                    <td><button className="btn-ghost p-1.5" onClick={()=>setViewTx(tx)}><Eye size={13}/></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* View modal */}
      {viewTx && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setViewTx(null)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <div>
                <p className="font-bold" style={{ color:'var(--text-primary)' }}>{viewTx.number}</p>
                <p className="text-xs mt-0.5" style={{ color:'var(--text-muted)' }}>
                  {formatDate(viewTx.date)} · {(viewTx.contact as any)?.name||'No contact'}
                  {(viewTx.journal_entry as any)?.entry_number && ` · ${(viewTx.journal_entry as any).entry_number}`}
                </p>
              </div>
              <button className="btn-ghost p-2" onClick={()=>setViewTx(null)}><X size={16}/></button>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto">
              {[
                ['Type', viewTx.type],
                ['Source', (viewTx.journal_entry as any)?.source_type || 'manual'],
                ['Subtotal', formatCurrency(viewTx.subtotal,currency)],
                ['Tax', formatCurrency(viewTx.tax_amount,currency)],
                ['Total', formatCurrency(viewTx.total,currency)],
                ['Balance Due', formatCurrency(viewTx.balance_due,currency)],
                ['Status', viewTx.status],
              ].map(([k,v])=>(
                <div key={k} className="flex justify-between py-2" style={{ borderBottom:'1px solid var(--border-light)' }}>
                  <span className="text-sm" style={{ color:'var(--text-secondary)' }}>{k}</span>
                  <span className="text-sm font-semibold capitalize" style={{ color:'var(--text-primary)' }}>{v}</span>
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
