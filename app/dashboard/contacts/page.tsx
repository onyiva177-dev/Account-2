'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Users, Edit2, X, CheckCircle2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { name:'', type:'customer', email:'', phone:'', address:'', city:'', tax_pin:'', notes:'' }

export default function ContactsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<typeof BLANK>(BLANK)
  const [saving, setSaving] = useState(false)
  const currency = organization?.base_currency || 'KES'

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*')
      .eq('organization_id', organization!.id).eq('is_active', true).order('name')
    setContacts(data || [])
    setLoading(false)
  }

  const openCreate = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit   = (c: any) => {
    setEditing(c)
    setForm({ name:c.name, type:c.type, email:c.email||'', phone:c.phone||'',
      address:c.address||'', city:c.city||'', tax_pin:c.tax_pin||'', notes:c.notes||'' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('contacts').update({ ...form }).eq('id', editing.id)
      toast.success('Contact updated')
    } else {
      await supabase.from('contacts').insert({ ...form, organization_id:organization!.id, balance:0, currency, is_active:true })
      toast.success(`${form.name} added`)
    }
    setShowModal(false); setSaving(false); load()
  }

  const softDelete = async (id:string, name:string) => {
    await supabase.from('contacts').update({ is_active:false }).eq('id', id)
    toast.success(`${name} removed`); load()
  }

  const upd = (k:string,v:string) => setForm(p=>({...p,[k]:v}))

  const filtered = contacts.filter(c =>
    (filter==='all' || c.type===filter) &&
    (!search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.email?.toLowerCase().includes(search.toLowerCase()))
  )

  const stats = {
    customers: contacts.filter(c=>['customer','both'].includes(c.type)).length,
    vendors:   contacts.filter(c=>['vendor','supplier','both'].includes(c.type)).length,
    employees: contacts.filter(c=>c.type==='employee').length,
    ar:        contacts.filter(c=>c.balance>0).reduce((s,c)=>s+c.balance,0),
    ap:        contacts.filter(c=>c.balance<0).reduce((s,c)=>s+Math.abs(c.balance),0),
  }

  const TYPE_COLORS: Record<string,{bg:string;col:string}> = {
    customer: { bg:'#e8f0fe', col:'#1557b0' },
    vendor:   { bg:'#f0eeff', col:'#5b4dd1' },
    supplier: { bg:'#f0eeff', col:'#5b4dd1' },
    employee: { bg:'#e6f4ea', col:'#137333' },
    both:     { bg:'#fef7e0', col:'#b06000' },
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Contacts</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>Customers, vendors and employees</p>
        </div>
        <button className="btn-primary flex-shrink-0" onClick={openCreate}><Plus size={15}/>Add Contact</button>
      </div>

      {/* Stats — 2×2 + 1 on mobile, cleaner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label:'Customers', val:stats.customers, col:'var(--brand)' },
          { label:'Vendors',   val:stats.vendors,   col:'var(--purple)' },
          { label:'Employees', val:stats.employees, col:'var(--success)' },
          { label:'Receivable',val:formatCurrency(stats.ar,currency), col:'var(--warning)' },
          { label:'Payable',   val:formatCurrency(stats.ap,currency), col:'var(--danger)' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>{s.label}</p>
            <p className="font-bold text-sm sm:text-base mt-0.5 truncate" style={{ color:s.col }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Search + filter — stacked on mobile */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }} />
          <input className="input pl-8 text-sm" placeholder="Search contacts…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {/* Filter chips — scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all','customer','vendor','employee'].map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: filter===f ? 'var(--brand)' : 'var(--bg-card)',
                color: filter===f ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${filter===f ? 'var(--brand)' : 'var(--border)'}`,
              }}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
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
                <th>Name</th>
                <th>Type</th>
                <th className="hidden sm:table-cell">Email</th>
                <th className="hidden sm:table-cell">Phone</th>
                <th className="text-right">Balance</th>
                <th style={{ width:'48px' }}></th>
              </tr>
            </thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_,i)=>(
                <tr key={i}>{Array(6).fill(0).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
              )) : filtered.length===0 ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color:'var(--text-muted)' }}>
                  <Users size={28} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No contacts found</p>
                </td></tr>
              ) : filtered.map(c => {
                const tc = TYPE_COLORS[c.type] || { bg:'var(--bg-table-head)', col:'var(--text-secondary)' }
                return (
                  <tr key={c.id}>
                    <td className="font-medium text-sm">{c.name}</td>
                    <td>
                      <span className="badge text-xs capitalize"
                        style={{ background:tc.bg, color:tc.col }}>{c.type}</span>
                    </td>
                    <td className="text-xs hidden sm:table-cell" style={{ color:'var(--text-secondary)' }}>{c.email||'—'}</td>
                    <td className="text-xs hidden sm:table-cell" style={{ color:'var(--text-secondary)' }}>{c.phone||'—'}</td>
                    <td className="text-right font-mono text-sm"
                      style={{ color:c.balance>0?'var(--warning)':c.balance<0?'var(--danger)':'var(--text-muted)' }}>
                      {formatCurrency(c.balance,currency)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost p-1.5" onClick={()=>openEdit(c)}><Edit2 size={13}/></button>
                        <button className="btn-ghost p-1.5" style={{ color:'var(--danger)' }}
                          onClick={()=>softDelete(c.id,c.name)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — bottom sheet on mobile */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(32,33,36,0.5)' }}
          onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col"
            style={{ background:'var(--bg-card)', border:'1px solid var(--border)' }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom:'1px solid var(--border)' }}>
              <h2 className="font-bold" style={{ color:'var(--text-primary)' }}>{editing?'Edit Contact':'New Contact'}</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowModal(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className="input-label">Full Name *</label>
                <input className="input" placeholder="Kamau Enterprises" value={form.name} onChange={e=>upd('name',e.target.value)} />
              </div>
              <div>
                <label className="input-label">Type *</label>
                <select className="input" value={form.type} onChange={e=>upd('type',e.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor / Supplier</option>
                  <option value="employee">Employee</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Email</label>
                  <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e=>upd('email',e.target.value)} /></div>
                <div><label className="input-label">Phone</label>
                  <input className="input" placeholder="+254700000000" value={form.phone} onChange={e=>upd('phone',e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">City</label>
                  <input className="input" placeholder="Nairobi" value={form.city} onChange={e=>upd('city',e.target.value)} /></div>
                <div><label className="input-label">KRA PIN</label>
                  <input className="input" placeholder="A000000000X" value={form.tax_pin} onChange={e=>upd('tax_pin',e.target.value)} /></div>
              </div>
              <div><label className="input-label">Notes</label>
                <input className="input" placeholder="Optional" value={form.notes} onChange={e=>upd('notes',e.target.value)} /></div>
            </div>
            <div className="flex gap-3 p-4" style={{ borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary flex-1" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>
                <CheckCircle2 size={15}/>{saving?'Saving…':editing?'Save':'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
