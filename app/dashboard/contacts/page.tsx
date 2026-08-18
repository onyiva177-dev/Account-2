'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Edit2, Trash2, X, CheckCircle2, MessageSquare, MessageCircle, Users, Building2, UserCheck, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { name:'', type:'customer', email:'', phone:'', whatsapp_number:'', address:'', city:'', tax_pin:'', notes:'' }

export default function ContactsPage() {
  const supabase = createClient()
  const { organization, profile } = useAppStore()
  const currency = organization?.base_currency || 'KES'
  const [contacts, setContacts]     = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState('all')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<any>(null)
  const [form, setForm]             = useState<typeof BLANK>(BLANK)
  const [saving, setSaving]         = useState(false)
  const [msgTarget, setMsgTarget]   = useState<any>(null)
  const [msgText, setMsgText]       = useState('')
  const [msgChannel, setMsgChannel] = useState<'app'|'whatsapp'>('whatsapp')
  const [sending, setSending]       = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  useEffect(() => { if (organization) load() }, [organization])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('contacts').select('*')
      .eq('organization_id', organization!.id).eq('is_active', true).order('name')
    if (error) toast.error('Load failed: ' + error.message)
    setContacts(data || [])
    const { data: members } = await supabase.from('profiles')
      .select('id, full_name, email').eq('organization_id', organization!.id)
    setTeamMembers(members || [])
    setLoading(false)
  }

  const openCreate = () => { setEditing(null); setForm(BLANK); setShowModal(true) }
  const openEdit = (c: any) => {
    setEditing(c)
    setForm({
      name: c.name||'', type: c.type||'customer', email: c.email||'',
      phone: c.phone||'', whatsapp_number: c.whatsapp_number||'',
      address: c.address||'', city: c.city||'', tax_pin: c.tax_pin||'', notes: c.notes||'',
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(), type: form.type,
      email: form.email || null, phone: form.phone || null,
      whatsapp_number: form.whatsapp_number || null,
      address: form.address || null, city: form.city || null,
      tax_pin: form.tax_pin || null, notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('contacts').update(payload).eq('id', editing.id)
      if (error) { toast.error('Update failed: ' + error.message); setSaving(false); return }
      toast.success('Updated')
    } else {
      const { error } = await supabase.from('contacts').insert({
        ...payload, organization_id: organization!.id,
        balance: 0, currency: currency, is_active: true,
      })
      if (error) { toast.error('Add failed: ' + error.message); setSaving(false); return }
      toast.success(`${form.name} added`)
    }
    setShowModal(false); setSaving(false); load()
  }

  const remove = async (id: string, name: string) => {
    const { error } = await supabase.from('contacts').update({ is_active: false }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success(`${name} removed`); load()
  }

  const sendMessage = async () => {
    if (!msgText.trim()) { toast.error('Type a message'); return }
    setSending(true)
    if (msgChannel === 'whatsapp') {
      const res = await fetch('/api/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: msgTarget.id, message: msgText }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || 'WhatsApp send failed')
      else { toast.success('WhatsApp sent — reply will appear in Messages'); setMsgTarget(null); setMsgText('') }
    } else {
      const match = teamMembers.find(m => m.email === msgTarget.email)
      if (!match) { toast.error('Employee not on FinAI — use WhatsApp'); setSending(false); return }
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: match.id, message: msgText }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error)
      else { toast.success('In-app message sent'); setMsgTarget(null); setMsgText('') }
    }
    setSending(false)
  }

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  const isEmployee = (c: any) => c.type === 'employee'
  const isOnFinAI  = (c: any) => teamMembers.some(m => m.email === c.email && c.email)

  const filtered = contacts.filter(c =>
    (filter === 'all' || c.type === filter || (filter === 'vendor' && c.type === 'supplier')) &&
    (!search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
  )

  const TYPE_STYLE: Record<string,{bg:string;col:string}> = {
    customer:{ bg:'#e8f0fe', col:'#1557b0' }, vendor:{ bg:'#f0eeff', col:'#5b4dd1' },
    supplier:{ bg:'#f0eeff', col:'#5b4dd1' }, employee:{ bg:'#e6f4ea', col:'#137333' },
    both:    { bg:'#fef7e0', col:'#b06000' },
  }

  const stats = {
    customers: contacts.filter(c=>c.type==='customer'||c.type==='both').length,
    vendors:   contacts.filter(c=>c.type==='vendor'||c.type==='supplier').length,
    employees: contacts.filter(c=>c.type==='employee').length,
    ar: contacts.filter(c=>c.balance>0).reduce((s,c)=>s+c.balance,0),
    ap: contacts.filter(c=>c.balance<0).reduce((s,c)=>s+Math.abs(c.balance),0),
  }

  return (
    <div className="space-y-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-bold" style={{ color:'var(--text-primary)' }}>Contacts</h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{ color:'var(--text-secondary)' }}>Customers, vendors and employees</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={15}/>Add Contact</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label:'Customers',  val:stats.customers, col:'var(--brand)' },
          { label:'Vendors',    val:stats.vendors,   col:'var(--purple)' },
          { label:'Employees',  val:stats.employees, col:'var(--success)' },
          { label:'Receivable', val:formatCurrency(stats.ar,currency), col:'var(--warning)' },
          { label:'Payable',    val:formatCurrency(stats.ap,currency), col:'var(--danger)' },
        ].map(s=>(
          <div key={s.label} className="card p-3">
            <p className="text-xs" style={{ color:'var(--text-muted)' }}>{s.label}</p>
            <p className="font-bold text-sm mt-0.5 truncate" style={{ color:s.col }}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {[{key:'all',label:'All',icon:Users},{key:'customer',label:'Customers',icon:UserCheck},{key:'vendor',label:'Vendors',icon:Building2},{key:'employee',label:'Employees',icon:Users}].map(t=>{
          const Icon=t.icon; return (
            <button key={t.key} onClick={()=>setFilter(t.key)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all"
              style={{
                background:filter===t.key?'var(--brand)':'var(--bg-table-head)',
                color:filter===t.key?'#fff':'var(--text-secondary)',
                border:`1px solid ${filter===t.key?'var(--brand)':'var(--border)'}`,
              }}>
              <Icon size={13}/>{t.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
        <input className="input pl-8 text-sm" placeholder="Search contacts…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Name</th><th>Type</th><th className="hidden sm:table-cell">Email</th><th className="hidden sm:table-cell">Phone</th><th className="text-right">Balance</th><th style={{width:'90px'}}>Actions</th></tr></thead>
            <tbody>
              {loading ? Array(5).fill(0).map((_,i)=>(
                <tr key={i}>{Array(6).fill(0).map((_,j)=><td key={j}><div className="skeleton h-4 rounded"/></td>)}</tr>
              )) : filtered.length===0 ? (
                <tr><td colSpan={6} className="text-center py-10" style={{ color:'var(--text-muted)' }}>
                  <Users size={28} className="mx-auto mb-2 opacity-30"/><p className="text-sm">No contacts found</p>
                </td></tr>
              ) : filtered.map(c=>{
                const ts=TYPE_STYLE[c.type]||{bg:'var(--bg-table-head)',col:'var(--text-secondary)'}
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{background:ts.bg,color:ts.col}}>
                          {c.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <p className="text-sm font-medium truncate" style={{color:'var(--text-primary)'}}>{c.name}</p>
                      </div>
                    </td>
                    <td><span className="badge text-xs capitalize" style={{background:ts.bg,color:ts.col}}>{c.type}</span></td>
                    <td className="text-xs hidden sm:table-cell" style={{color:'var(--text-secondary)'}}>{c.email||'—'}</td>
                    <td className="text-xs hidden sm:table-cell" style={{color:'var(--text-secondary)'}}>{c.phone||'—'}</td>
                    <td className="text-right font-mono text-sm" style={{color:c.balance>0?'var(--warning)':c.balance<0?'var(--danger)':'var(--text-muted)'}}>
                      {formatCurrency(c.balance,currency)}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-ghost p-1.5"
                          style={{color:isEmployee(c)&&isOnFinAI(c)?'var(--brand)':'#25D366'}}
                          onClick={()=>{setMsgTarget(c);setMsgChannel(isEmployee(c)&&isOnFinAI(c)?'app':'whatsapp');setMsgText('')}}
                          title={isEmployee(c)&&isOnFinAI(c)?'In-app message':'WhatsApp'}>
                          {isEmployee(c)&&isOnFinAI(c)?<MessageCircle size={13}/>:<MessageSquare size={13}/>}
                        </button>
                        <button className="btn-ghost p-1.5" onClick={()=>openEdit(c)}><Edit2 size={13}/></button>
                        <button className="btn-ghost p-1.5" style={{color:'var(--danger)'}} onClick={()=>remove(c.id,c.name)}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message modal */}
      {msgTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:'rgba(0,0,0,0.5)'}} onClick={e=>e.target===e.currentTarget&&setMsgTarget(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <div className="flex items-center justify-between p-4" style={{borderBottom:'1px solid var(--border)'}}>
              <div>
                <p className="font-bold" style={{color:'var(--text-primary)'}}>Message {msgTarget.name}</p>
                <p className="text-xs mt-0.5" style={{color:'var(--text-muted)'}}>{msgTarget.whatsapp_number||msgTarget.phone||msgTarget.email||'No contact info'}</p>
              </div>
              <button className="btn-ghost p-2" onClick={()=>setMsgTarget(null)}><X size={16}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <button onClick={()=>setMsgChannel('whatsapp')} className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  style={{background:msgChannel==='whatsapp'?'#25D366':'var(--bg-table-head)',color:msgChannel==='whatsapp'?'#fff':'var(--text-secondary)',border:`1px solid ${msgChannel==='whatsapp'?'#25D366':'var(--border)'}`}}>
                  <MessageSquare size={14}/>WhatsApp
                </button>
                {isEmployee(msgTarget)&&isOnFinAI(msgTarget)&&(
                  <button onClick={()=>setMsgChannel('app')} className="flex-1 py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    style={{background:msgChannel==='app'?'var(--brand)':'var(--bg-table-head)',color:msgChannel==='app'?'#fff':'var(--text-secondary)',border:`1px solid ${msgChannel==='app'?'var(--brand)':'var(--border)'}`}}>
                    <MessageCircle size={14}/>In-App
                  </button>
                )}
              </div>
              <div className="text-xs p-2 rounded-lg" style={{background:msgChannel==='whatsapp'?'#d4edda':'var(--brand-dim)',color:msgChannel==='whatsapp'?'#155724':'var(--brand)'}}>
                {msgChannel==='whatsapp'?'Sent to their WhatsApp. Reply appears in your Messages inbox.':'Delivered inside FinAI — they see it when they log in.'}
              </div>
              <textarea className="input" rows={4} placeholder="Type your message…" value={msgText} onChange={e=>setMsgText(e.target.value)} style={{resize:'vertical',height:'auto'}}/>
              <div className="flex gap-3">
                <button className="btn-secondary flex-1" onClick={()=>setMsgTarget(null)}>Cancel</button>
                <button className="btn-primary flex-1 justify-center" onClick={sendMessage} disabled={sending}>
                  <Send size={14}/>{sending?'Sending…':'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{background:'rgba(0,0,0,0.5)'}} onClick={e=>e.target===e.currentTarget&&setShowModal(false)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col" style={{background:'var(--bg-card)',border:'1px solid var(--border)'}}>
            <div className="flex items-center justify-between p-4" style={{borderBottom:'1px solid var(--border)'}}>
              <h2 className="font-bold" style={{color:'var(--text-primary)'}}>{editing?'Edit Contact':'New Contact'}</h2>
              <button className="btn-ghost p-2" onClick={()=>setShowModal(false)}><X size={16}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div><label className="input-label">Full Name *</label>
                <input className="input" placeholder="Kamau Enterprises" value={form.name} onChange={e=>upd('name',e.target.value)}/></div>
              <div><label className="input-label">Type *</label>
                <select className="input" value={form.type} onChange={e=>upd('type',e.target.value)}>
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor / Supplier</option>
                  <option value="employee">Employee</option>
                  <option value="both">Both</option>
                </select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">Email</label>
                  <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e=>upd('email',e.target.value)}/></div>
                <div><label className="input-label">Phone</label>
                  <input className="input" placeholder="+254700000000" value={form.phone} onChange={e=>upd('phone',e.target.value)}/></div>
              </div>
              <div><label className="input-label">WhatsApp Number</label>
                <input className="input" placeholder="+254700000000" value={form.whatsapp_number} onChange={e=>upd('whatsapp_number',e.target.value)}/>
                <p className="text-xs mt-1" style={{color:'var(--text-muted)'}}>For sending WhatsApp messages directly from FinAI</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="input-label">City</label>
                  <input className="input" placeholder="Nairobi" value={form.city} onChange={e=>upd('city',e.target.value)}/></div>
                <div><label className="input-label">KRA PIN</label>
                  <input className="input" placeholder="A000000000X" value={form.tax_pin} onChange={e=>upd('tax_pin',e.target.value)}/></div>
              </div>
              <div><label className="input-label">Notes</label>
                <input className="input" placeholder="Optional" value={form.notes} onChange={e=>upd('notes',e.target.value)}/></div>
            </div>
            <div className="flex gap-3 p-4" style={{borderTop:'1px solid var(--border)'}}>
              <button className="btn-secondary flex-1" onClick={()=>setShowModal(false)}>Cancel</button>
              <button className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>
                <CheckCircle2 size={15}/>{saving?'Saving…':editing?'Save Changes':'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
