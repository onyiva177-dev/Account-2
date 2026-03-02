'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useAppStore } from '@/lib/store'
import { formatCurrency } from '@/lib/utils'
import { Plus, Search, Users, Building2, User } from 'lucide-react'
import type { Contact } from '@/types'

export default function ContactsPage() {
  const supabase = createClient()
  const { organization } = useAppStore()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const currency = organization?.base_currency || 'KES'

  useEffect(() => {
    if (!organization) return
    supabase.from('contacts').select('*').eq('organization_id', organization.id).order('name').then(({ data }) => {
      setContacts(data || [])
      setLoading(false)
    })
  }, [organization])

  const filtered = contacts.filter(c =>
    (filter === 'all' || c.type === filter || (filter === 'both' && c.type === 'both')) &&
    (!search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Customers, vendors and employees</p>
        </div>
        <button className="btn-primary"><Plus size={16} />Add Contact</button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['all', 'customer', 'vendor', 'employee'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${filter === f ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Type</th><th>Email</th><th>Phone</th><th className="text-right">Balance</th></tr>
          </thead>
          <tbody>
            {loading ? Array(5).fill(0).map((_, i) => (
              <tr key={i}>{Array(5).fill(0).map((_, j) => <td key={j}><div className="skeleton h-4 rounded" /></td>)}</tr>
            )) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-40" />
                  <p>No contacts found</p>
                </td>
              </tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td className="font-medium text-slate-800">{c.name}</td>
                <td>
                  <span className={`badge capitalize ${c.type === 'customer' ? 'bg-blue-100 text-blue-700' : c.type === 'vendor' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                    {c.type}
                  </span>
                </td>
                <td className="text-slate-500 text-sm">{c.email || '—'}</td>
                <td className="text-slate-500 text-sm">{c.phone || '—'}</td>
                <td className={`text-right font-mono text-sm ${c.balance > 0 ? 'text-amber-600 font-semibold' : c.balance < 0 ? 'text-danger-500 font-semibold' : 'text-slate-400'}`}>
                  {formatCurrency(c.balance, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
