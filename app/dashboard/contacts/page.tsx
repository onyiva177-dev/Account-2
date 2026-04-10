'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Users, Edit2, X, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const BLANK = { name: '', type: 'customer', email: '', phone: '', address: '', city: '', tax_pin: '', notes: '' }

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

  useEffect(() => {
    if (!organization) return
    load()
  }, [organization])

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
    setForm({ name: c.name, type: c.type, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', tax_pin: c.tax_pin || '', notes: c.notes || '' })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    if (editing) {
      const { error } = await supabase.from('contacts').update({ ...form, name: form.name.trim() }).eq('id', editing.id)
      if (error) { toast.error('Update failed: ' + error.message); setSaving(false); return }
      toast.success('Contact updated')
    } else {
      const { error } = await supabase.from('contacts').insert({ ...form, organization_id: organization!.id, balance: 0, currency, is_active: true, name: form.name.trim() })
      if (error) { toast.error('Create failed: ' + error.message); setSaving(false); return }
      toast.success(`${form.name} added`)
    }
    setShowModal(false); setSaving(false); load()
  }

  const softDelete = async (id: string, name: string) => {
    await supabase.from('contacts').update({ is_active: false }).eq('id', id)
    toast.success(`${name} removed`); load()
  }

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const filtered = contacts.filter(c =>
    (filter === 'all' || c.type === filter) &&
    (!search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
  )

  const stats = {
    customers: contacts.filter(c => ['customer','both'].includes(c.type)).length,
    vendors:   contacts.filter(c => ['vendor','supplier','both'].includes(c.type)).length,
    employees: contacts.filter(c => c.type === 'employee').length,
    ar:        contacts.filter(c => c.balance > 0).reduce((s, c) => s + c.balance, 0),
    ap:        contacts.filter(c => c.balance < 0).reduce((s, c) => s + Math.abs(c.balance), 0),
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customers, vendors and employees</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} />Add Contact</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Customers', value: stats.customers, color: 'text-blue-600 bg-blue-50' },
          { label: 'Vendors',   value: stats.vendors,   color: 'text-purple-600 bg-purple-50' },
          { label: 'Employees', value: stats.employees, color: 'text-green-600 bg-green-50' },
          { label: 'Receivable', value: formatCurrency(stats.ar, currency), color: 'text-amber-600 bg-amber-50' },
          { label: 'Payable',   value: formatCurrency(stats.ap, currency), color: 'text-red-500 bg-red-50' },
        ].map(s => (
          <div key={s.label} className="card p-3">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`font-bold text-lg mt-0.5 ${s.color.split(' ')[0]}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all','customer','vendor','employee'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Email</th><th>Phone</th><th>City</th><th className="text-right">Balance</th><th></th></tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No contacts found. Click "Add Contact" to create one.</p>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td className="font-medium text-slate-800">{c.name}</td>
                <td>
                  <span className={`badge capitalize ${
                    c.type === 'customer' ? 'bg-blue-100 text-blue-700' :
                    ['vendor','supplier'].includes(c.type) ? 'bg-purple-100 text-purple-700' :
                    c.type === 'employee' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                  }`}>{c.type}</span>
                </td>
                <td className="text-slate-500 text-sm">{c.email || '—'}</td>
                <td className="text-slate-500 text-sm">{c.phone || '—'}</td>
                <td className="text-slate-500 text-sm">{c.city || '—'}</td>
                <td className={`text-right font-mono text-sm ${c.balance > 0 ? 'text-amber-600 font-semibold' : c.balance < 0 ? 'text-danger-500 font-semibold' : 'text-slate-400'}`}>
                  {formatCurrency(c.balance, currency)}
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button className="btn-ghost p-1.5" onClick={() => openEdit(c)} title="Edit"><Edit2 size={14} /></button>
                    <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => softDelete(c.id, c.name)} title="Remove"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Contact' : 'New Contact'}</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="input-label">Full Name *</label>
                  <input className="input" placeholder="Kamau Enterprises" value={form.name} onChange={e => upd('name', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Contact Type *</label>
                  <select className="input" value={form.type} onChange={e => upd('type', e.target.value)}>
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor / Supplier</option>
                    <option value="employee">Employee</option>
                    <option value="both">Both (Customer & Vendor)</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Email</label>
                  <input type="email" className="input" placeholder="contact@email.com" value={form.email} onChange={e => upd('email', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input className="input" placeholder="+254700000000" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">City</label>
                  <input className="input" placeholder="Nairobi" value={form.city} onChange={e => upd('city', e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="input-label">Address</label>
                  <input className="input" placeholder="P.O. Box 123, CBD" value={form.address} onChange={e => upd('address', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">KRA PIN / Tax ID</label>
                  <input className="input" placeholder="A000000000X" value={form.tax_pin} onChange={e => upd('tax_pin', e.target.value)} />
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <input className="input" placeholder="Optional notes" value={form.notes} onChange={e => upd('notes', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
